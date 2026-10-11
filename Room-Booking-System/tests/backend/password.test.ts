import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {Request,Response} from 'express';
import { SqliteStore } from '../../apps/backend/src/infrastructure/sqlite-store';
import { emptyData } from '../../apps/backend/src/infrastructure/store';
import { readConfig } from '../../apps/backend/src/common/config';
import { createApplication } from '../../apps/backend/src/main';
import { PasswordAuth } from '../../apps/backend/src/modules/password-auth';
import { hashPassword,verifyPassword } from '../../apps/backend/src/modules/password-hash';
import { linkGoogle } from '../../apps/backend/src/modules/auth-service';
import { digest } from '../../apps/backend/src/modules/session';
const origin='http://127.0.0.1:5174';
const password='A long test passphrase 2026';
const changed='Another long test passphrase';
test('Argon2id uses a unique salt, verifies Unicode and never returns plaintext',async()=>{
 const value='รหัสผ่านสำหรับทดสอบอย่างเดียว';
 const a=await hashPassword(value),b=await hashPassword(value);
 const fields=a.split('$');assert.equal(fields[1],'argon2id');assert.equal(fields[2],'v=19');
 assert.deepEqual(Object.fromEntries(fields[3].split(',').map(pair=>pair.split('='))),{m:'65536',t:'3',p:'1'});assert.notEqual(a,b);assert.ok(!a.includes(value));
 assert.equal(await verifyPassword(a,value),true);assert.equal(await verifyPassword(a,'incorrect'),false);assert.equal(await verifyPassword('broken',value),false);
});
test('Google-only HTTP surface disables every password entry point without changing stored accounts',async()=>{
 const initial=emptyData();initial.state.users.push({id:1,email:'login@example.com',name:'Test user',role:'USER',active:true,phone:'',affiliation:''});
 initial.credentials.push({userId:1,passwordHash:await hashPassword(password),failedAttempts:0,updatedAt:new Date().toISOString()});
 const store=new SqliteStore(':memory:',initial),app=await createApplication(store,readConfig({APP_ORIGIN:origin}));
 await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 try {
  const before=await store.read();
  const config=await (await fetch(base+'/api/config')).json();assert.equal(config.passwordReady,false);assert.equal(config.registrationReady,false);
  for(const path of ['login','register','confirm','request-reset','reset','set']) {
   const response=await fetch(base+'/api/auth/password/'+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'login@example.com',password,token:'legacy-token'})});
   assert.equal(response.status,404);assert.equal(response.headers.get('set-cookie'),null);
  }
  assert.deepEqual(await store.read(),before);
  assert.equal((await fetch(base+'/api/auth/google',{redirect:'manual'})).status,503);
 }finally{await app.close();await store.close();}
});
test('self enrollment verifies one-use email tokens, reset revokes sessions, mail failure cannot activate accounts',async()=>{
 const store=new SqliteStore(':memory:');const messages:string[]=[];
 const c=readConfig({APP_ORIGIN:origin,SMTP_HOST:'test-mail',MAIL_FROM:'test@example.com',ALLOW_PUBLIC_GOOGLE:'1'});
 const auth=new PasswordAuth(store,c,async(_to,_subject,content)=>{messages.push(content);});
 const req={headers:{origin}} as Request;
 function lastToken(){return messages.at(-1)!.match(/token=([A-Za-z0-9_-]{43})/)![1];}
 try {
  await assert.rejects(auth.register(req,{email:'anyone@example.com',password:'short',name:'User'}));
  await assert.rejects(auth.register(req,{email:'anyone@example.com',password,name:'User',role:'ADMIN'}));
  await auth.register(req,{email:'anyone@example.com',password,name:'User'});
  assert.equal((await store.read()).state.users.length,0);
  const first=lastToken(),pending=(await store.read()).passwordTokens[0];assert.equal(pending.tokenHash,digest(first));assert.ok(pending.passwordHash?.startsWith('$argon2id$'));assert.ok(!JSON.stringify(await store.read()).includes(first));
  await auth.confirm(req,{token:first});assert.equal((await store.read()).state.users[0].role,'USER');
  await assert.rejects(auth.confirm(req,{token:first}));
  await auth.requestReset(req,{email:'anyone@example.com'});const resetToken=lastToken();
  await store.transaction(d=>{d.sessions.push({hash:'old-session',csrf:'old-csrf',userId:1,expiresAt:'2030-01-01T00:00:00Z'});});
  await auth.reset(req,{token:resetToken,password:changed});assert.equal((await store.read()).sessions.length,0);
  assert.equal(await verifyPassword((await store.read()).credentials[0].passwordHash,changed),true);
  await assert.rejects(auth.reset(req,{token:resetToken,password}));
  await auth.requestReset(req,{email:'anyone@example.com'});const expired=lastToken();
  await store.transaction(d=>{d.passwordTokens.find(t=>t.tokenHash===digest(expired))!.expiresAt='2000-01-01T00:00:00Z';});
  await assert.rejects(auth.reset(req,{token:expired,password}));
  const sent=messages.length;await auth.requestReset(req,{email:'not-registered@example.com'});assert.equal(messages.length,sent);
  const failing=new PasswordAuth(store,c,async()=>{throw new Error('SMTP unavailable');});
  await assert.rejects(failing.register(req,{email:'failure@example.com',name:'Failure',password}));
  assert.ok(!(await store.read()).passwordTokens.some(t=>t.email==='failure@example.com'));
  assert.ok(!(await store.read()).state.users.some(t=>t.email==='failure@example.com'));
 }finally{await store.close();}
});
test('Google accepts verified emails on any domain; public signup cannot choose roles',()=>{
 const c=readConfig({ALLOW_PUBLIC_GOOGLE:'1'}),d=emptyData(),now=new Date().toISOString();
 const user=linkGoogle(d,{sub:'public-google-user',email:'public@example.com',email_verified:true},c,now);assert.equal(user.role,'USER');
 assert.throws(()=>linkGoogle(d,{sub:'unverified',email:'another@example.com',email_verified:false},c,now));
});
