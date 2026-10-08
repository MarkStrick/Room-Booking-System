import * as oidc from 'openid-client';
import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Config } from '../common/config';
import type { Data, Store } from '../infrastructure/store';
import { cookieOptions, digest, flowCookie, issueSession, secret } from './session';
export interface GoogleClaims {sub:string;email?:unknown;email_verified?:unknown;hd?:unknown;name?:unknown}
export function linkGoogle(data:Data,claims:GoogleClaims,c:Config,now:string) {
 const email=typeof claims.email==='string'?claims.email.toLowerCase():'';
 const domain=email.split('@')[1];
 if(!claims.sub||claims.email_verified!==true||!domain)throw new ForbiddenException('บัญชี Google ยังไม่ได้ยืนยันอีเมล');
 if(!c.allowPublicGoogle&&(!c.allowedDomains.includes(domain)||typeof claims.hd!=='string'||!c.allowedDomains.includes(claims.hd.toLowerCase())))throw new ForbiddenException('กรุณาใช้บัญชีมหาวิทยาลัยที่ได้รับอนุญาต');
 const identity=data.identities.find(i=>i.subject===claims.sub);
 if(identity) {
  const user=data.state.users.find(u=>u.id===identity.userId);
  if(!user?.active)throw new ForbiddenException('บัญชีถูกปิดใช้งาน กรุณาติดต่อเจ้าหน้าที่');
  user.email=email;
  return user;
 }
 if(data.state.users.some(u=>u.email.toLowerCase()===email))throw new ForbiddenException('อีเมลนี้มีบัญชีผูกไว้แล้ว กรุณาติดต่อผู้ดูแล');
 const id=Math.max(0,...data.state.users.map(u=>u.id))+1;
 const user={id,email,name:typeof claims.name==='string'?claims.name.slice(0,120):email.split('@')[0],phone:'',affiliation:'',role:c.bootstrapAdmins.includes(email)?'ADMIN' as const:'USER' as const,active:true};
 data.state.users.push(user);data.identities.push({subject:claims.sub,userId:id});
 data.state.audit.unshift({id:Math.max(0,...data.state.audit.map(a=>a.id))+1,actorId:id,at:now,text:'สร้างบัญชีจาก Google ที่ยืนยันแล้ว'});
 return user;
}
export class GoogleAuth {
 private client?:Promise<oidc.Configuration>;
 constructor(private store:Store,private c:Config){}
 ready(){return Boolean(this.c.googleId&&this.c.googleSecret&&(this.c.allowedDomains.length||this.c.allowPublicGoogle));}
 private configuration() {
  if(!this.ready())throw new ServiceUnavailableException('ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาติดต่อผู้ดูแล');
  return this.client??=oidc.discovery(new URL('https://accounts.google.com'),this.c.googleId,this.c.googleSecret);
 }
 async start(res:Response) {
  const client=await this.configuration();
  const token=secret(),state=oidc.randomState(),nonce=oidc.randomNonce(),verifier=oidc.randomPKCECodeVerifier();
  const now=new Date().toISOString();
  await this.store.transaction(data=>{
   data.flows=data.flows.filter(f=>f.expiresAt>now);
   data.flows.push({hash:digest(token),verifier,state,nonce,expiresAt:new Date(Date.now()+600000).toISOString()});
  });
  res.cookie(flowCookie(this.c),token,{...cookieOptions(this.c),maxAge:600000});
  const url=oidc.buildAuthorizationUrl(client,{redirect_uri:`${this.c.origin}/api/auth/google/callback`,scope:'openid email profile',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',prompt:'select_account'});
  res.redirect(url.href);
 }
 async callback(req:Request,res:Response) {
  const cookie=req.cookies?.[flowCookie(this.c)];
  if(typeof cookie!=='string')throw new UnauthorizedException('หมดเวลาเข้าสู่ระบบ กรุณาลองอีกครั้ง');
  const now=new Date().toISOString();
  const flow=await this.store.transaction(data=>{
   const f=data.flows.find(f=>f.hash===digest(cookie)&&f.expiresAt>now);
   if(!f)throw new UnauthorizedException('การเข้าสู่ระบบนี้หมดอายุหรือถูกใช้แล้ว');
   data.flows=data.flows.filter(x=>x.hash!==f.hash);return f;
  });
  res.clearCookie(flowCookie(this.c),cookieOptions(this.c));
  const client=await this.configuration();
  const tokens=await oidc.authorizationCodeGrant(client,new URL(req.originalUrl,this.c.origin),{pkceCodeVerifier:flow.verifier,expectedState:flow.state,expectedNonce:flow.nonce,idTokenExpected:true});
  const claims=tokens.claims();
  if(!claims)throw new UnauthorizedException('ไม่พบข้อมูลยืนยันบัญชี Google');
  await this.store.transaction(data=>{const user=linkGoogle(data,claims,this.c,now);issueSession(data,user.id,now,req,res,this.c);});
  res.redirect(`${this.c.origin}/#/rooms`);
 }
}
