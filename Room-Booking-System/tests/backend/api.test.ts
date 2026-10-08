import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from '../../apps/backend/src/infrastructure/sqlite-store';
import { emptyData } from '../../apps/backend/src/infrastructure/store';
import { createSeed } from '../../apps/web/src/lib/seed';
import { createApplication } from '../../apps/backend/src/main';
import { readConfig } from '../../apps/backend/src/common/config';
import { claimMail, finishMail, runTimers } from '../../apps/backend/src/modules/jobs';
import { linkGoogle } from '../../apps/backend/src/modules/auth-service';
import { addDays, dateOf, stamp } from '../../packages/core/src/domain';
const origin='http://127.0.0.1:5174';
function fixture(){const d=emptyData(),s=createSeed();d.state={...d.state,users:s.users,rooms:s.rooms,buildings:s.buildings,equipment:s.equipment,assignments:s.assignments};return d;}
test('HTTP sessions, scoped data, concurrency, idempotency, CSRF, roles and revocation',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'kku-api-'));
 const store=new SqliteStore(join(dir,'integration.sqlite'),fixture());
 const app=await createApplication(store,readConfig({DEV_LOGIN:'1',APP_ORIGIN:origin}));
 await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 async function call(path:string,options:RequestInit={}){return fetch(`${base}/api${path}`,{...options,headers:{'content-type':'application/json',origin,...options.headers}});}
 async function login(userId:number){const res=await call('/auth/development',{method:'POST',body:JSON.stringify({userId})});assert.equal(res.status,201);return {body:await res.json(),cookie:res.headers.get('set-cookie')!.split(';')[0]};}
 try {
  const student=await login(1),other=await login(4),staff=await login(2),admin=await login(3);
  const headers=(client:typeof student)=>({cookie:client.cookie,'x-csrf-token':client.body.csrfToken,'idempotency-key':randomUUID()});
  const tomorrow=addDays(dateOf(new Date().toISOString()),1);
  const booking={type:'BOOK',roomId:1,start:stamp(tomorrow,'10:00'),end:stamp(tomorrow,'12:00'),purpose:'integration request',attendees:4,participants:[],equipment:[{id:1,qty:1}]};
  await t.test('unauthenticated calls fail, forged actorId and clock commands are rejected',async()=>{
   assert.equal((await call('/state')).status,401);
   assert.equal((await call('/commands',{method:'POST',headers:headers(student),body:JSON.stringify({...booking,actorId:3})})).status,400);
   assert.equal((await call('/commands',{method:'POST',headers:headers(student),body:JSON.stringify({type:'CLOCK',now:'2099-01-01T00:00:00Z'})})).status,400);
  });
  await t.test('CSRF and foreign origins fail before any writes',async()=>{
   assert.equal((await call('/commands',{method:'POST',headers:{cookie:student.cookie},body:JSON.stringify(booking)})).status,403);
   assert.equal((await call('/commands',{method:'POST',headers:{...headers(student),origin:'https://evil.example'},body:JSON.stringify(booking)})).status,403);
   assert.equal((await store.read()).state.bookings.length,0);
  });
  let createdId=0;
  await t.test('simultaneous identical slots have one winner, and data is scoped',async()=>{
   const results=await Promise.all([call('/commands',{method:'POST',headers:headers(student),body:JSON.stringify(booking)}),call('/commands',{method:'POST',headers:headers(other),body:JSON.stringify(booking)})]);
   assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
   const persisted=await store.read();assert.equal(persisted.state.bookings.length,1);createdId=persisted.state.bookings[0].id;
   const winner=persisted.state.bookings[0].userId===1?student:other;
   const loser=winner===student?other:student;
   const scoped=await (await call('/state',{headers:{cookie:loser.cookie}})).json();
   assert.equal(scoped.bookings[0].userId,0);assert.equal(scoped.bookings[0].purpose,'');assert.equal(scoped.bookings[0].ref,'');
   assert.equal(scoped.users.length,1);assert.deepEqual(scoped.messages,[]);assert.deepEqual(scoped.notices,[]);
   assert.equal(persisted.state.equipment[0].remaining,persisted.state.equipment[0].total-1);
   assert.equal((await call('/commands',{method:'POST',headers:headers(loser),body:JSON.stringify({type:'CANCEL',bookingId:createdId})})).status,403);
  });
  await t.test('retrying one idempotency key creates one booking and one stock allocation',async()=>{
   const second={...booking,roomId:3,start:stamp(tomorrow,'14:00'),end:stamp(tomorrow,'15:00')};
   const h=headers(student),before=(await store.read()).state.equipment[0].remaining;
   assert.equal((await call('/commands',{method:'POST',headers:h,body:JSON.stringify(second)})).status,201);
   assert.equal((await call('/commands',{method:'POST',headers:h,body:JSON.stringify(second)})).status,201);
   assert.equal((await store.read()).state.bookings.filter(b=>b.roomId===3).length,1);
   assert.equal((await store.read()).state.equipment[0].remaining,before-1);
   assert.equal((await call('/commands',{method:'POST',headers:h,body:JSON.stringify({...second,purpose:'changed'})})).status,409);
  });
  await t.test('students cannot approve, assigned staff can, and notices stay queued without SMTP',async()=>{
   assert.equal((await call('/commands',{method:'POST',headers:headers(student),body:JSON.stringify({type:'DECIDE',bookingId:createdId,approve:true,reason:''})})).status,403);
   assert.equal((await call('/commands',{method:'POST',headers:headers(staff),body:JSON.stringify({type:'DECIDE',bookingId:createdId,approve:true,reason:''})})).status,201);
   const scoped=await (await call('/state',{headers:{cookie:staff.cookie}})).json();
   assert.equal(scoped.bookings.find((b:{roomId:number})=>b.roomId===3).purpose,'');
   assert.ok((await store.read()).state.notices.every(n=>n.status==='QUEUED'));
  });
  await t.test('reading a notice changes only its owner read marker and is idempotent',async()=>{
   const notice=(await store.read()).state.notices.find(n=>n.userId===1)!;
   const mark={type:'READ_NOTICE',noticeId:notice.id},h=headers(student);
   assert.equal((await call('/commands',{method:'POST',headers:headers(other),body:JSON.stringify(mark)})).status,403);
   assert.equal((await call('/commands',{method:'POST',headers:h,body:JSON.stringify(mark)})).status,201);
   const first=(await store.read()).state.notices.find(n=>n.id===notice.id)!;
   assert.ok(first.readAt);assert.equal(first.status,'QUEUED');
   assert.equal((await call('/commands',{method:'POST',headers:h,body:JSON.stringify(mark)})).status,201);
   assert.equal((await store.read()).state.notices.find(n=>n.id===notice.id)!.readAt,first.readAt);
  });
  await t.test('admin deactivation revokes an existing session and the admin cannot lock itself out',async()=>{
   assert.equal((await call('/admin/access',{method:'POST',headers:headers(student),body:JSON.stringify({userId:4,role:'ADMIN',roomIds:[],active:true})})).status,403);
   assert.equal((await call('/admin/access',{method:'POST',headers:headers(admin),body:JSON.stringify({userId:3,role:'USER',roomIds:[],active:true})})).status,400);
   assert.equal((await call('/admin/access',{method:'POST',headers:headers(admin),body:JSON.stringify({userId:4,role:'USER',roomIds:[],active:false})})).status,201);
   assert.equal((await call('/state',{headers:{cookie:other.cookie}})).status,401);
  });
  await t.test('logout invalidates the server session',async()=>{
   assert.equal((await call('/auth/logout',{method:'POST',headers:headers(student)})).status,201);
   assert.equal((await call('/state',{headers:{cookie:student.cookie}})).status,401);
  });
 }finally{await app.close();await store.close();await rm(dir,{recursive:true,force:true});}
});
test('durable transaction rollback, no-show idempotence, fenced mail retries and recovery',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kku-durable-')),path=join(dir,'store.sqlite');
 let store=new SqliteStore(path,fixture());
 try {
  await assert.rejects(store.transaction(d=>{d.state.users[0].name='should rollback';throw new Error('failure');}));
  assert.notEqual((await store.read()).state.users[0].name,'should rollback');
  await store.transaction(d=>{const s=createSeed();d.state.bookings=[s.bookings.find(b=>b.status==='APPROVED')!];});
  const now='2026-10-08T10:01:00+07:00';await store.transaction(d=>runTimers(d,now));await store.transaction(d=>runTimers(d,now));
  const data=await store.read();assert.equal(data.state.violations.length,1);assert.equal(data.outbox.length,1);
  const mail=await store.transaction(d=>claimMail(d,now));assert.ok(mail);
  const recovered=await store.transaction(d=>claimMail(d,'2026-10-08T10:04:00+07:00'));assert.ok(recovered);
  await store.transaction(d=>finishMail(d,mail.notice.id,mail.token,now,true));assert.equal((await store.read()).outbox[0].status,'SENDING');
  await store.transaction(d=>finishMail(d,recovered.notice.id,recovered.token,now,false));assert.equal((await store.read()).state.notices[0].status,'QUEUED');
  await store.close();store=new SqliteStore(path);assert.equal((await store.read()).state.bookings[0].status,'NO_SHOW');
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});
test('Google identities require verified hosted university claims, and link by sub',()=>{
 const c=readConfig({ALLOWED_GOOGLE_DOMAINS:'kkumail.com',ALLOW_PUBLIC_GOOGLE:'0'}),d=emptyData(),now=new Date().toISOString();
 assert.throws(()=>linkGoogle(d,{sub:'1',email:'student@kkumail.com',email_verified:false,hd:'kkumail.com'},c,now));
 assert.throws(()=>linkGoogle(d,{sub:'1',email:'student@kkumail.com',email_verified:true},c,now));
 assert.throws(()=>linkGoogle(d,{sub:'1',email:'student@gmail.com',email_verified:true,hd:'gmail.com'},c,now));
 const user=linkGoogle(d,{sub:'1',email:'student@kkumail.com',email_verified:true,hd:'kkumail.com'},c,now);assert.equal(user.role,'USER');
 assert.equal(linkGoogle(d,{sub:'1',email:'renamed@kkumail.com',email_verified:true,hd:'kkumail.com'},c,now).id,user.id);
 assert.equal(d.state.users.length,1);
});
test('production refuses development login, missing config, insecure origins and SQLite',()=>{
 assert.throws(()=>readConfig({NODE_ENV:'production',DEV_LOGIN:'1'}));
 assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'http://example.com'}));
 assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'https://example.com',DB_DRIVER:'sqlite'}));
 assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'https://example.com'}));
});
