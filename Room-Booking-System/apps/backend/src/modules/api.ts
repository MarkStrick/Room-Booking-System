import { Body, Controller, Get, Inject, Module, Post, Req, Res, BadRequestException, ForbiddenException, HttpException, Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Store } from '../infrastructure/store';
import type { Config } from '../common/config';
import { actor, checkCsrf, checkOrigin, cookieOptions, digest, issueSession, sessionCookie } from './session';
import { GoogleAuth } from './auth-service';
import { PasswordAuth } from './password-auth';
import { applyCommand } from './booking-service';
import { projectState } from '../common/projection';
import { runTimers } from './jobs';
import { assignmentSchema } from '../common/validation';
export const STORE='STORE',CONFIG='CONFIG';
@Catch()
class Errors implements ExceptionFilter {
 catch(error:unknown,host:ArgumentsHost) {
  const res=host.switchToHttp().getResponse<Response>();
  if(error instanceof HttpException){res.status(error.getStatus()).json(typeof error.getResponse()==='string'?{message:error.message}:error.getResponse());return;}
  const code=(error as {code?:string}).code;
  if(code==='23P01'||code==='23505'){res.status(409).json({code:'DATA_CONFLICT',message:'ข้อมูลมีการเปลี่ยนแปลงหรือซ้ำ กรุณารีเฟรชแล้วลองใหม่'});return;}
  console.error(JSON.stringify({event:'request_error',code:code??'INTERNAL_ERROR'}));
  res.status(500).json({code:'INTERNAL_ERROR',message:'ไม่สามารถทำรายการได้ในขณะนี้ กรุณาลองอีกครั้ง'});
 }
}
@Controller('api')
export class ApiController {
 private google:GoogleAuth;
 private passwords:PasswordAuth;
 constructor(@Inject(STORE) private store:Store,@Inject(CONFIG)private c:Config){this.google=new GoogleAuth(store,c);this.passwords=new PasswordAuth(store,c);}
 @Get('config') config(){return {googleReady:this.google.ready(),passwordReady:this.passwords.ready(),registrationReady:this.passwords.registrationReady(),devLogin:this.c.devLogin,allowedDomains:this.c.allowedDomains};}
 @Post('auth/password/register') async passwordRegister(@Req()req:Request,@Body()body:unknown){return this.passwords.register(req,body);}
 @Post('auth/password/confirm') async passwordConfirm(@Req()req:Request,@Body()body:unknown){return this.passwords.confirm(req,body);}
 @Post('auth/password/request-reset') async passwordRequestReset(@Req()req:Request,@Body()body:unknown){return this.passwords.requestReset(req,body);}
 @Post('auth/password/reset') async passwordReset(@Req()req:Request,@Body()body:unknown){return this.passwords.reset(req,body);}
 @Post('auth/password/login') async passwordLogin(@Req()req:Request,@Res({passthrough:true})res:Response,@Body()body:unknown){return this.passwords.login(req,res,body);}
 @Post('auth/password/set') async passwordSet(@Req()req:Request,@Res({passthrough:true})res:Response,@Body()body:unknown){return this.passwords.set(req,res,body);}
 @Get('health/live') live(){return {status:'ok'};}
 @Get('health/ready') async ready(){await this.store.read();return {status:'ok'};}
 @Get('session') async session(@Req()req:Request) {
  const data=await this.store.read(),now=new Date().toISOString();
  const {user,session}=actor(data,req.cookies?.[sessionCookie(this.c)],now);
  return {user,csrfToken:session.csrf,hasPassword:data.credentials.some(c=>c.userId===user.id),state:projectState({...data.state,now},user)};
 }
 @Get('state') async state(@Req()req:Request) {
  const data=await this.store.read(),now=new Date().toISOString();
  const {user}=actor(data,req.cookies?.[sessionCookie(this.c)],now);
  return projectState({...data.state,now},user);
 }
 @Post('commands') async command(@Req()req:Request,@Body()body:unknown) {
  return this.store.transaction(data=>{
   const now=new Date().toISOString(),{user,session}=actor(data,req.cookies?.[sessionCookie(this.c)],now);
   checkCsrf(req,session.csrf,this.c);runTimers(data,now);
   return applyCommand(data,user.id,body,req.get('idempotency-key'),now);
  });
 }
 @Post('auth/logout') async logout(@Req()req:Request,@Res({passthrough:true})res:Response) {
  await this.store.transaction(data=>{
   const {session}=actor(data,req.cookies?.[sessionCookie(this.c)],new Date().toISOString());checkCsrf(req,session.csrf,this.c);
   data.sessions=data.sessions.filter(s=>s.hash!==session.hash);
  });
  res.clearCookie(sessionCookie(this.c),cookieOptions(this.c));return {ok:true};
 }
 @Post('auth/development') async development(@Req()req:Request,@Res({passthrough:true})res:Response,@Body()body:{userId?:number}) {
  if(!this.c.devLogin)throw new ForbiddenException('เส้นทางนี้ปิดใช้งาน');checkOrigin(req,this.c);
  return this.store.transaction(data=>{
   const user=data.state.users.find(u=>u.id===body?.userId&&u.active);
   if(!user||![1,2,3,4].includes(user.id))throw new BadRequestException('ไม่พบบัญชีทดสอบ');
   const now=new Date().toISOString();const csrfToken=issueSession(data,user.id,now,req,res,this.c);
   return {user,csrfToken,state:projectState({...data.state,now},user)};
  });
 }
 @Get('auth/google') async googleStart(@Res()res:Response){await this.google.start(res);}
 @Get('auth/google/callback') async googleCallback(@Req()req:Request,@Res()res:Response) {
  try{await this.google.callback(req,res);}catch{res.clearCookie('kku_flow',cookieOptions(this.c));res.clearCookie('__Host-kku_flow',cookieOptions(this.c));res.redirect(`${this.c.origin}/?login_error=1`);}
 }
 @Post('admin/access') async access(@Req()req:Request,@Body()body:unknown) {
  const parsed=assignmentSchema.safeParse(body);if(!parsed.success)throw new BadRequestException('ข้อมูลสิทธิ์ไม่ถูกต้อง');
  return this.store.transaction(data=>{
   const now=new Date().toISOString(),{user,session}=actor(data,req.cookies?.[sessionCookie(this.c)],now);checkCsrf(req,session.csrf,this.c);
   if(user.role!=='ADMIN')throw new ForbiddenException('เฉพาะผู้ดูแลระบบ');
   const target=data.state.users.find(u=>u.id===parsed.data.userId);if(!target)throw new BadRequestException('ไม่พบบัญชี');
   if(target.id===user.id&&(parsed.data.role!=='ADMIN'||!parsed.data.active))throw new BadRequestException('ไม่สามารถลดสิทธิ์หรือปิดบัญชีที่กำลังใช้งาน');
   if(!parsed.data.roomIds.every(id=>data.state.rooms.some(r=>r.id===id)))throw new BadRequestException('ไม่พบห้องที่เลือก');
   target.role=parsed.data.role;
   target.active=parsed.data.active;
   if(!target.active)data.sessions=data.sessions.filter(s=>s.userId!==target.id);
   data.state.assignments=data.state.assignments.filter(a=>a.userId!==target.id);
   if(target.role==='STAFF')data.state.assignments.push({userId:target.id,roomIds:[...new Set(parsed.data.roomIds)]});
   data.state.audit.unshift({id:Math.max(0,...data.state.audit.map(a=>a.id))+1,at:now,actorId:user.id,text:`เปลี่ยนสิทธิ์บัญชี ${target.id} เป็น ${target.role}`});
   return projectState({...data.state,now},user);
  });
 }
}
export function apiModule(store:Store,c:Config) {
 @Module({controllers:[ApiController],providers:[{provide:STORE,useValue:store},{provide:CONFIG,useValue:c},{provide:APP_FILTER,useClass:Errors}]})class ApiModule{}
 return ApiModule;
}
