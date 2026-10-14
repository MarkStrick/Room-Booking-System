import { Body, Controller, Get, Inject, Module, Post, Req, Res, BadRequestException, ForbiddenException, HttpException, Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Store } from '../infrastructure/store';
import { mailConfigured, type Config } from '../common/config';
import { actor, checkCsrf, checkOrigin, cookieOptions, digest, issueSession, sessionCookie } from './session';
import { GoogleAuth } from './auth-service';
import { applyCommand } from './booking-service';
import { projectState } from '../common/projection';
import { runTimers } from './jobs';
import { assignmentSchema } from '../common/validation';
import { openApi } from '../common/openapi';
import { timingSafeEqual } from 'node:crypto';
import { runJobCycle } from './job-runner';
export const STORE='STORE',CONFIG='CONFIG';
@Catch()
class Errors implements ExceptionFilter {
 catch(error:unknown,host:ArgumentsHost) {
  const res=host.switchToHttp().getResponse<Response>();
  if(error instanceof HttpException){res.status(error.getStatus()).json(typeof error.getResponse()==='string'?{message:error.message}:error.getResponse());return;}
  const code=(error as {code?:string}).code;
  if(code==='23P01'||code==='23505'){res.status(409).json({code:'DATA_CONFLICT',message:'ข้อมูลมีการเปลี่ยนแปลงหรือซ้ำ กรุณารีเฟรชแล้วลองใหม่'});return;}
  if(code==='23514'||code==='23503'||code==='23502'){res.status(409).json({code:'DATA_CONSTRAINT',message:'ข้อมูลไม่ตรงตามเงื่อนไขของระบบ กรุณารีเฟรชแล้วตรวจข้อมูลอีกครั้ง'});return;}
  console.error(JSON.stringify({event:'request_error',code:code??'INTERNAL_ERROR'}));
  res.status(500).json({code:'INTERNAL_ERROR',message:'ไม่สามารถทำรายการได้ในขณะนี้ กรุณาลองอีกครั้ง'});
 }
}
@Controller('api')
export class ApiController {
 private google:GoogleAuth;
 constructor(@Inject(STORE) private store:Store,@Inject(CONFIG)private c:Config){this.google=new GoogleAuth(store,c);}
 @Get('config') config(){return {googleReady:this.google.ready(),passwordReady:false,registrationReady:false,emailReady:mailConfigured(this.c),allowedDomains:this.c.allowPublicGoogle?[]:this.c.allowedDomains};}
 @Get('openapi.json') docs(){return openApi(sessionCookie(this.c));}
 @Get('public/catalog') async catalog(){return this.store.transaction(data=>{const now=new Date().toISOString();runTimers(data,now);return projectState(data.state,{id:0,name:'ผู้เยี่ยมชม',email:'',phone:'',affiliation:'',role:'USER',active:false});});}
 @Get('health/live') live(){return {status:'ok'};}
 @Get('internal/jobs') async scheduledJobs(@Req()req:Request) {
  const expected=`Bearer ${this.c.cronSecret}`,provided=req.get('authorization')??'';
  if(this.c.cronSecret.length<32||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))throw new ForbiddenException('ไม่มีสิทธิ์เรียกงานอัตโนมัติ');
  const result=await runJobCycle(this.store,this.c);
  console.log(JSON.stringify({event:'scheduled_jobs_complete',...result}));
  return {ok:true,...result};
 }
 @Get('health/ready') async ready(){await this.store.read();return {status:'ok'};}
 @Get('admin/operations') async operations(@Req()req:Request){const data=await this.store.read(),now=new Date().toISOString(),{user}=actor(data,req.cookies?.[sessionCookie(this.c)],now);if(user.role!=='ADMIN')throw new ForbiddenException('เฉพาะผู้ดูแลระบบ');return {workerAt:data.state.settings?.workerAt??null,workerHealthy:!!data.state.settings?.workerAt&&Date.parse(now)-Date.parse(data.state.settings.workerAt)<120000,queued:data.outbox.filter(o=>o.status==='QUEUED').length,failed:data.outbox.filter(o=>o.status==='FAILED').length};}
 @Get('admin/test-tools') async testTools(@Req()req:Request) {
  const data=await this.store.read(),{user}=actor(data,req.cookies?.[sessionCookie(this.c)],new Date().toISOString());
  if(user.role!=='ADMIN')throw new ForbiddenException('เฉพาะผู้ดูแลระบบ');
  return {enabled:true,mode:'isolated',writesToProduction:false};
 }
 @Get('admin/readiness') async readiness(@Req()req:Request) {
  const data=await this.store.read(),now=new Date().toISOString(),{user}=actor(data,req.cookies?.[sessionCookie(this.c)],now);
  if(user.role!=='ADMIN')throw new ForbiddenException('เฉพาะผู้ดูแลระบบ');
  const checks=[
   {id:'database',label:'ฐานข้อมูลจริง',ready:this.c.store==='postgres',detail:this.c.store==='postgres'?'เชื่อมต่อและอ่านฐานข้อมูลได้':'กำลังใช้ฐานข้อมูลในเครื่อง'},
   {id:'origin',label:'เว็บไซต์ HTTPS',ready:this.c.production&&this.c.origin.startsWith('https:'),detail:this.c.production?'ตั้งค่าโหมดใช้งานจริงแล้ว':'กำลังใช้งานบนเครื่องพัฒนา'},
   {id:'email',label:'อีเมลแจ้งผลการจอง',ready:mailConfigured(this.c),detail:this.c.smtpHost&&this.c.mailFrom?'ตั้งค่าผู้ส่งอีเมลแล้ว ต้องยืนยันการรับอีเมลจริงก่อนเปิดบริการ':'ยังไม่ได้ตั้งค่าผู้ส่งอีเมล'},
   {id:'google',label:'เข้าสู่ระบบด้วย Google',ready:this.google.ready(),detail:this.google.ready()?'ตั้งค่าแล้ว ต้องทดสอบการเข้าสู่ระบบจริง':'ยังไม่ได้ตั้งค่า Google'},
   {id:'worker',label:'งานอัตโนมัติ',ready:!!data.state.settings?.workerAt&&Date.parse(now)-Date.parse(data.state.settings.workerAt)<120000,detail:data.state.settings?.workerAt?'รอบล่าสุด '+data.state.settings.workerAt:'ยังไม่มีรอบการทำงาน'},
   {id:'catalog',label:'ห้องที่พร้อมให้จอง',ready:data.state.rooms.some(r=>r.active!==false&&data.state.buildings.some(b=>b.id===r.buildingId&&b.active!==false)&&!!r.hours),detail:'ต้องตั้งข้อมูลห้องจริงและเวลาทำการก่อนรับผู้ใช้'},
   {id:'contact',label:'ช่องทางติดต่อ',ready:!!(data.state.settings?.contactEmail||data.state.settings?.contactPhone),detail:'ตั้งค่าได้ในหน้านี้'},
   {id:'test-login',label:'ความปลอดภัยของเครื่องมือทดสอบ',ready:true,detail:'บัญชีทดสอบล็อกอินโดยตรงไม่ได้ พื้นที่จำลองจำกัดเฉพาะผู้ดูแล'},
  ];
  return {checkedAt:now,ready:checks.every(c=>c.ready),checks};
 }
 @Get('session') async session(@Req()req:Request) {
  return this.store.transaction(data=>{const now=new Date().toISOString();
  const {user,session}=actor(data,req.cookies?.[sessionCookie(this.c)],now);
  runTimers(data,now);
  return {user,csrfToken:session.csrf,hasPassword:data.credentials.some(c=>c.userId===user.id),state:projectState(data.state,user)};});
 }
 @Get('state') async state(@Req()req:Request) {
  return this.store.transaction(data=>{const now=new Date().toISOString();
  const {user}=actor(data,req.cookies?.[sessionCookie(this.c)],now);
  runTimers(data,now);
  return projectState(data.state,user);});
 }
 @Post('commands') async command(@Req()req:Request,@Body()body:unknown) {
  const result=await this.store.transaction(data=>{
   const now=new Date().toISOString(),{user,session}=actor(data,req.cookies?.[sessionCookie(this.c)],now);
   checkCsrf(req,session.csrf,this.c);runTimers(data,now);
   if(typeof body==='object'&&body!==null&&'type' in body&&body.type==='SEND_NOTICE'&&!mailConfigured(this.c))throw new BadRequestException('ยังไม่ได้เชื่อมบริการอีเมล กรุณาตั้งค่า SMTP ก่อนส่ง');
   return applyCommand(data,user.id,body,req.get('idempotency-key'),now);
  });
  // The violation and rejected attempt are durable before HTTP 409 is raised.
  if(result instanceof HttpException)throw result;
  return result;
 }
 @Post('auth/logout') async logout(@Req()req:Request,@Res({passthrough:true})res:Response) {
  await this.store.transaction(data=>{
   const {session}=actor(data,req.cookies?.[sessionCookie(this.c)],new Date().toISOString());checkCsrf(req,session.csrf,this.c);
   data.sessions=data.sessions.filter(s=>s.hash!==session.hash);
  });
  res.clearCookie(sessionCookie(this.c),cookieOptions(this.c));return {ok:true};
 }
 @Post('auth/development') development() {throw new ForbiddenException('ปิดการเข้าสู่ระบบด้วยบัญชีทดสอบ กรุณาเข้าสู่ระบบด้วยบัญชีจริง');}
 @Get('auth/google') async googleStart(@Res()res:Response){await this.google.start(res);}
 @Get('auth/google/callback') async googleCallback(@Req()req:Request,@Res()res:Response) {
  try{await this.google.callback(req,res);}catch(error){
   const detail=error instanceof ForbiddenException?error.getResponse():null;
   const reason=typeof detail==='object'&&detail!==null&&'code' in detail&&detail.code==='GOOGLE_DOMAIN_NOT_ALLOWED'?'domain':'1';
   res.clearCookie('kku_flow',cookieOptions(this.c));res.clearCookie('__Host-kku_flow',cookieOptions(this.c));res.redirect(`${this.c.origin}/?login_error=${reason}`);
  }
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
   if(target.role==='STAFF')data.state.assignments.push({userId:target.id,roomIds:[...new Set(parsed.data.roomIds)],start:parsed.data.start,end:parsed.data.end});
   data.state.audit.unshift({id:Math.max(0,...data.state.audit.map(a=>a.id))+1,at:now,actorId:user.id,text:`เปลี่ยนสิทธิ์บัญชี ${target.id} เป็น ${target.role}`});
   return projectState({...data.state,now},user);
  });
 }
}
export function apiModule(store:Store,c:Config) {
 @Module({controllers:[ApiController],providers:[{provide:STORE,useValue:store},{provide:CONFIG,useValue:c},{provide:APP_FILTER,useClass:Errors}]})class ApiModule{}
 return ApiModule;
}
