import { BadRequestException, ForbiddenException, UnauthorizedException,ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import type { Request,Response } from 'express';
import type { Config } from '../common/config';
import type { Store } from '../infrastructure/store';
import { actor,checkCsrf,checkOrigin,issueSession,sessionCookie,secret,digest } from './session';
import { authMail,type AuthMail } from '../common/auth-mail';
import { projectState } from '../common/projection';
import { hashPassword,verifyPassword } from './password-hash';
const email=z.email().max(254).trim().toLowerCase();
const password=z.string().min(1).max(128);
export const newPassword=password.min(12,'รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร');
const loginSchema=z.strictObject({email,password});
const setSchema=z.strictObject({password:newPassword,currentPassword:password.optional()});
const registerSchema=z.strictObject({email,password:newPassword,name:z.string().trim().min(1).max(120)});
const token=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const confirmSchema=z.strictObject({token});
const resetSchema=z.strictObject({token,password:newPassword});
const denied=()=>new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีไม่พร้อมใช้งาน');
let dummyHash:Promise<string>|undefined;
export class PasswordAuth {
 constructor(private store:Store,private c:Config,private mail:AuthMail=authMail(c)){}
 ready(){return this.c.allowPublicGoogle||this.c.allowedDomains.length>0;}
 registrationReady(){return this.ready()&&Boolean(this.c.smtpHost&&this.c.mailFrom);}
 private allowed(address:string){return this.c.allowPublicGoogle||this.c.allowedDomains.includes(address.split('@')[1]);}
 async login(req:Request,res:Response,raw:unknown) {
  checkOrigin(req,this.c);
  const parsed=loginSchema.safeParse(raw);if(!parsed.success)throw denied();
  const {email:address,password}=parsed.data,data=await this.store.read();
  const user=data.state.users.find(u=>u.email.toLowerCase()===address);
  const credential=user&&data.credentials.find(c=>c.userId===user.id);
  let candidate=credential?.passwordHash;
  if(!candidate){dummyHash??=hashPassword(secret()).catch(e=>{dummyHash=undefined;throw e;});candidate=await dummyHash;}
  const matches=await verifyPassword(candidate,password);
  const now=new Date().toISOString();
  const result=await this.store.transaction(d=>{
   const latest=user&&d.state.users.find(u=>u.id===user.id);
   const current=latest&&d.credentials.find(c=>c.userId===latest.id);
   if(!latest?.active||!this.allowed(address)||latest.email.toLowerCase()!==address||!current||current.passwordHash!==credential?.passwordHash)return null;
   if(current.lockedUntil&&current.lockedUntil>now)return null;
   if(!matches) {
    if(current.lockedUntil&&current.lockedUntil<=now)current.failedAttempts=0;
    current.failedAttempts++;
    if(current.failedAttempts>=5)current.lockedUntil=new Date(Date.parse(now)+15*60000).toISOString();
    return null;
   }
   current.failedAttempts=0;delete current.lockedUntil;
   const csrfToken=issueSession(d,latest.id,now,req,res,this.c);
   return {user:latest,csrfToken,hasPassword:true,state:projectState({...d.state,now},latest)};
  });
  if(!result)throw denied();return result;
 }
 async set(req:Request,res:Response,raw:unknown) {
  const parsed=setSchema.safeParse(raw);if(!parsed.success)throw new BadRequestException('รหัสผ่านใหม่ต้องยาว 12–128 ตัวอักษร');
  const data=await this.store.read(),now=new Date().toISOString();
  const {user,session}=actor(data,req.cookies?.[sessionCookie(this.c)],now);checkCsrf(req,session.csrf,this.c);
  if(!this.allowed(user.email))throw new ForbiddenException('บัญชีนี้ยังไม่อยู่ในโดเมนที่อนุญาต');
  const previous=data.credentials.find(c=>c.userId===user.id);
  if(!previous&&Date.parse(session.expiresAt)-12*3600000<Date.now()-15*60000)throw new UnauthorizedException('กรุณาเข้าสู่ระบบใหม่ก่อนตั้งรหัสผ่านครั้งแรก');
  if(previous&&(!parsed.data.currentPassword||!await verifyPassword(previous.passwordHash,parsed.data.currentPassword)))throw denied();
  const passwordHash=await hashPassword(parsed.data.password);
  return this.store.transaction(d=>{
   const {user:latest,session:live}=actor(d,req.cookies?.[sessionCookie(this.c)],new Date().toISOString());checkCsrf(req,live.csrf,this.c);
   const current=d.credentials.find(c=>c.userId===latest.id);
   if(current?.passwordHash!==previous?.passwordHash||!this.allowed(latest.email))throw denied();
   d.credentials=d.credentials.filter(c=>c.userId!==latest.id);
   d.credentials.push({userId:latest.id,passwordHash,updatedAt:now,failedAttempts:0});
   d.passwordTokens=d.passwordTokens.filter(t=>t.userId!==latest.id&&t.email!==latest.email.toLowerCase());
   d.sessions=d.sessions.filter(s=>s.userId!==latest.id);
   const csrfToken=issueSession(d,latest.id,now,req,res,this.c);
   return {user:latest,csrfToken,hasPassword:true,state:projectState({...d.state,now},latest)};
  });
 }
 async register(req:Request,raw:unknown) {
  checkOrigin(req,this.c);
  if(!this.registrationReady())throw new ServiceUnavailableException('การสมัครสมาชิกยังไม่พร้อม กรุณาติดต่อผู้ดูแล');
  const parsed=registerSchema.safeParse(raw);if(!parsed.success)throw new BadRequestException('กรอกอีเมล ชื่อ และรหัสผ่าน 12–128 ตัวอักษรให้ครบ');
  const {email:address,name,password}=parsed.data;
  if(!this.allowed(address))throw new BadRequestException('กรุณาใช้อีเมลในโดเมนที่ได้รับอนุญาต');
  const passwordHash=await hashPassword(password),value=secret(),tokenHash=digest(value),now=new Date().toISOString();
  const accepted=await this.store.transaction(d=>{
   if(d.state.users.some(u=>u.email.toLowerCase()===address))return false;
   d.passwordTokens=d.passwordTokens.filter(t=>t.expiresAt>now&&!(t.email===address&&t.kind==='register'));
   // Each request owns its token; failure of an older send cannot delete a newer request.
   d.passwordTokens.push({tokenHash,kind:'register',email:address,name,passwordHash,expiresAt:new Date(Date.parse(now)+30*60000).toISOString()});return true;
  });
  if(accepted)await this.send(tokenHash,address,'ยืนยันอีเมลสำหรับ KKU SPACE',`${this.c.origin}/#/verify-email?token=${value}`);
  return {message:'หากอีเมลนี้สมัครสมาชิกได้ ระบบส่งลิงก์ยืนยันให้แล้ว กรุณาตรวจกล่องจดหมายและอีเมลขยะ'};
 }
 private async send(tokenHash:string,address:string,subject:string,link:string) {
  try{await this.mail(address,subject,`${subject}\n\nเปิดลิงก์นี้ภายใน 30 นาที:\n${link}\n\nหากคุณไม่ได้ทำรายการ ไม่ต้องดำเนินการใด ๆ`);}
  catch{await this.store.transaction(d=>{d.passwordTokens=d.passwordTokens.filter(t=>t.tokenHash!==tokenHash);});throw new ServiceUnavailableException('ส่งอีเมลไม่ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง');}
 }
 async confirm(req:Request,raw:unknown) {
  checkOrigin(req,this.c);
  const parsed=confirmSchema.safeParse(raw);if(!parsed.success)throw new BadRequestException('ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาสมัครใหม่');
  return this.store.transaction(d=>{
   const now=new Date().toISOString(),hash=digest(parsed.data.token),pending=d.passwordTokens.find(t=>t.tokenHash===hash&&t.kind==='register'&&t.expiresAt>now);
   if(!pending?.passwordHash||!pending.name||!this.allowed(pending.email)||d.state.users.some(u=>u.email.toLowerCase()===pending.email))throw new BadRequestException('ลิงก์ไม่ถูกต้อง หมดอายุ หรือบัญชีนี้ถูกสร้างแล้ว กรุณาเข้าสู่ระบบหรือสมัครใหม่');
   const id=Math.max(0,...d.state.users.map(u=>u.id))+1;
   // Elevated bootstrap access comes only from server configuration and a verified email.
   d.state.users.push({id,email:pending.email,name:pending.name,phone:'',affiliation:'',role:this.c.bootstrapAdmins.includes(pending.email)?'ADMIN':'USER',active:true});
   d.credentials.push({userId:id,passwordHash:pending.passwordHash,updatedAt:now,failedAttempts:0});
   d.passwordTokens=d.passwordTokens.filter(t=>t.email!==pending.email);
   return {message:'ยืนยันอีเมลแล้ว เข้าสู่ระบบด้วยรหัสผ่านได้เลย'};
  });
 }
 async requestReset(req:Request,raw:unknown) {
  checkOrigin(req,this.c);
  if(!this.registrationReady())throw new ServiceUnavailableException('ระบบส่งลิงก์ยังไม่พร้อม กรุณาติดต่อผู้ดูแล');
  const parsed=z.strictObject({email}).safeParse(raw);if(!parsed.success)throw new BadRequestException('กรุณากรอกอีเมลให้ถูกต้อง');
  const address=parsed.data.email,data=await this.store.read(),user=data.state.users.find(u=>u.email.toLowerCase()===address&&u.active);
  if(user&&this.allowed(address)&&data.credentials.some(c=>c.userId===user.id)) {
   const value=secret(),tokenHash=digest(value),now=new Date().toISOString();
   await this.store.transaction(d=>{d.passwordTokens=d.passwordTokens.filter(t=>t.expiresAt>now);d.passwordTokens.push({tokenHash,kind:'reset',email:address,userId:user.id,expiresAt:new Date(Date.parse(now)+30*60000).toISOString()});});
   await this.send(tokenHash,address,'ตั้งรหัสผ่านใหม่สำหรับ KKU SPACE',`${this.c.origin}/#/reset-password?token=${value}`);
  }
  return {message:'หากอีเมลนี้มีบัญชีรหัสผ่านที่ใช้งานได้ ระบบจะส่งลิงก์ให้ กรุณาตรวจกล่องจดหมายและอีเมลขยะ'};
 }
 async reset(req:Request,raw:unknown) {
  checkOrigin(req,this.c);
  const parsed=resetSchema.safeParse(raw);if(!parsed.success)throw new BadRequestException('ตรวจลิงก์และรหัสผ่านใหม่ 12–128 ตัวอักษร');
  const hash=digest(parsed.data.token),data=await this.store.read();
  if(!data.passwordTokens.some(t=>t.tokenHash===hash&&t.kind==='reset'&&t.expiresAt>new Date().toISOString()))throw new BadRequestException('ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่');
  const passwordHash=await hashPassword(parsed.data.password);
  return this.store.transaction(d=>{
   const now=new Date().toISOString(),pending=d.passwordTokens.find(t=>t.tokenHash===hash&&t.kind==='reset'&&t.expiresAt>now),user=pending&&d.state.users.find(u=>u.id===pending.userId&&u.active);
   const credential=user&&d.credentials.find(c=>c.userId===user.id);
   if(!user||!pending||user.email.toLowerCase()!==pending.email||!this.allowed(user.email)||!credential)throw new BadRequestException('ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่');
   credential.passwordHash=passwordHash;credential.updatedAt=now;credential.failedAttempts=0;delete credential.lockedUntil;
   d.passwordTokens=d.passwordTokens.filter(t=>t.email!==user.email.toLowerCase());
   d.sessions=d.sessions.filter(s=>s.userId!==user.id);
   return {message:'ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบอีกครั้ง'};
  });
 }
}
