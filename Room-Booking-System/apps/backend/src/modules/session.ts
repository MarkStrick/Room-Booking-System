import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Config } from '../common/config';
import type { Data } from '../infrastructure/store';
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export const secret=()=>randomBytes(32).toString('base64url');
export const sessionCookie=(c:Config)=>c.production?'__Host-kku_session':'kku_session';
export const flowCookie=(c:Config)=>c.production?'__Host-kku_flow':'kku_flow';
export const cookieOptions=(c:Config)=>({httpOnly:true,secure:c.production,sameSite:'lax' as const,path:'/'});
export function actor(data:Data,token:unknown,now:string) {
 if(typeof token!=='string'||token.length>200)throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');
 const session=data.sessions.find(s=>s.hash===digest(token)&&s.expiresAt>now);
 const user=session&&data.state.users.find(u=>u.id===session.userId&&u.active);
 if(!session||!user)throw new UnauthorizedException('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง');
 return {session,user};
}
export function checkOrigin(req:Request,c:Config) {
 if(req.headers.origin!==c.origin)throw new ForbiddenException('คำขอไม่ได้มาจากเว็บไซต์ที่อนุญาต');
}
export function checkCsrf(req:Request,csrf:string,c:Config) {
 checkOrigin(req,c);
 const input=req.get('x-csrf-token');
 if(!input||input.length!==csrf.length||!timingSafeEqual(Buffer.from(input),Buffer.from(csrf)))throw new ForbiddenException('กรุณารีเฟรชหน้าเว็บแล้วลองอีกครั้ง');
}
export function issueSession(data:Data,userId:number,now:string,req:Request,res:Response,c:Config) {
 const previous=req.cookies?.[sessionCookie(c)];
 if(typeof previous==='string')data.sessions=data.sessions.filter(s=>s.hash!==digest(previous));
 data.sessions=data.sessions.filter(s=>s.expiresAt>now);
 const token=secret(),csrf=secret(),expiresAt=new Date(Date.parse(now)+12*3600000).toISOString();
 data.sessions.push({hash:digest(token),userId,csrf,expiresAt});
 res.cookie(sessionCookie(c),token,{...cookieOptions(c),maxAge:12*3600000});
 return csrf;
}
