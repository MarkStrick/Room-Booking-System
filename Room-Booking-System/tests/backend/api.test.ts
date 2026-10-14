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
import { applyCommand } from '../../apps/backend/src/modules/booking-service';
import { ConflictException } from '@nestjs/common';
import { testSession } from './session-fixture';
const origin='http://127.0.0.1:5174';
function fixture(){const d=emptyData(),s=createSeed();d.state={...d.state,users:s.users,rooms:s.rooms,buildings:s.buildings,equipment:s.equipment,assignments:s.assignments};return d;}
test('HTTP sessions, scoped data, concurrency, idempotency, CSRF, roles and revocation',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'kku-api-'));
 const store=new SqliteStore(join(dir,'integration.sqlite'),fixture());
 const app=await createApplication(store,readConfig({DEV_LOGIN:'1',APP_ORIGIN:origin}));
 await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 async function call(path:string,options:RequestInit={}){return fetch(`${base}/api${path}`,{...options,headers:{'content-type':'application/json',origin,...options.headers}});}
 async function login(userId:number){return testSession(store,readConfig({APP_ORIGIN:origin}),userId);}
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
  await t.test('late cancellation commits one violation before returning 409, including concurrent retries',async()=>{
   let id=0;
   await store.transaction(d=>{
    const b=d.state.bookings.find(b=>b.roomId===3&&b.userId===1)!;id=b.id;
    b.start=new Date(Date.now()+3600000).toISOString();b.end=new Date(Date.now()+7200000).toISOString();
   });
   const before=await store.read(),cancel={type:'CANCEL',bookingId:id},h=headers(student);
   assert.equal((await call('/commands',{method:'POST',headers:headers(other),body:JSON.stringify(cancel)})).status,403);
   assert.equal((await call('/commands',{method:'POST',headers:{...h,'x-csrf-token':'invalid'},body:JSON.stringify(cancel)})).status,403);
   assert.equal((await store.read()).state.violations.length,before.state.violations.length);
   const responses=await Promise.all([h,h,headers(student)].map(headers=>call('/commands',{method:'POST',headers,body:JSON.stringify(cancel)})));
   for(const response of responses){assert.equal(response.status,409);assert.equal((await response.json()).code,'CANCELLATION_TOO_LATE');}
   const after=await store.read();
   assert.equal(after.state.violations.filter(v=>v.bookingId===id&&v.type==='LATE_CANCEL').length,1);
   assert.equal(after.state.audit.length,before.state.audit.length+1);
   assert.deepEqual(after.state.bookings,before.state.bookings);
   assert.deepEqual(after.state.equipment,before.state.equipment);
   assert.deepEqual(after.state.notices,before.state.notices);
   assert.deepEqual(after.outbox,before.outbox);
   const changed=await call('/commands',{method:'POST',headers:h,body:JSON.stringify({type:'CANCEL',bookingId:createdId})});
   assert.equal(changed.status,409);assert.equal((await changed.json()).code,'IDEMPOTENCY_CONFLICT');
  });
  await t.test('HTTP room edits and approvals reject over-capacity bookings without partial writes',async()=>{
   const before=await store.read(),room=before.state.rooms.find(r=>r.id===3)!,booking=before.state.bookings.find(b=>b.roomId===3)!;
   const reduced=await call('/commands',{method:'POST',headers:headers(admin),body:JSON.stringify({type:'ROOM_SAVE',room:{...room,capacity:1}})});
   assert.equal(reduced.status,409);assert.equal((await reduced.json()).code,'ROOM_CAPACITY_CONFLICT');
   assert.deepEqual((await store.read()).state,before.state);
   // Simulate inconsistent legacy data to verify the independent approval guard.
   await store.transaction(d=>{d.state.rooms.find(r=>r.id===3)!.capacity=1;});
   const legacy=await store.read();
   const approved=await call('/commands',{method:'POST',headers:headers(admin),body:JSON.stringify({type:'DECIDE',bookingId:booking.id,approve:true,reason:''})});
   assert.equal(approved.status,409);assert.equal((await approved.json()).code,'ROOM_CAPACITY_EXCEEDED');
   const after=await store.read();assert.deepEqual(after.state,legacy.state);assert.deepEqual(after.outbox,legacy.outbox);
   const rejected=await call('/commands',{method:'POST',headers:headers(admin),body:JSON.stringify({type:'DECIDE',bookingId:booking.id,approve:false,reason:'จำนวนคนเกินความจุปัจจุบัน'})});
   assert.equal(rejected.status,201);
   assert.equal((await store.read()).state.bookings.find(b=>b.id===booking.id)!.status,'REJECTED');
  });
  await t.test('holiday management requires admin, validates dates, blocks bookings and persists edits',async()=>{
   const date=addDays(tomorrow,2),next=addDays(date,1);
   const poster='data:image/jpeg;base64,/9j/'+'A'.repeat(100000);
   const save={type:'HOLIDAY_SAVE',date,poster};
   const command=(client:typeof student,payload:unknown)=>call('/commands',{method:'POST',headers:headers(client),body:JSON.stringify(payload)});
   for(const client of [student,staff]) assert.equal((await command(client,save)).status,403);
   assert.equal((await command(admin,{...save,date:'2026-02-29'})).status,400);
   const before=(await store.read()).state;
   assert.equal((await command(admin,{type:'HOLIDAY_SAVE',date:tomorrow})).status,409);
   assert.deepEqual((await store.read()).state,before);
   assert.equal((await command(admin,save)).status,201);
   assert.ok((await store.read()).state.holidays.includes(date));
   assert.equal((await store.read()).state.settings?.holidayPosters?.[date],poster);
   const projected=await (await call('/state',{headers:{cookie:student.cookie}})).json();
   assert.equal(projected.settings.holidayPosters[date],poster);
   assert.equal((await command(admin,{...save,date:next,poster:'data:image/svg+xml;base64,AAAA'})).status,400);
   assert.equal((await command(admin,save)).status,409);
   assert.equal((await command(student,{...booking,start:stamp(date,'10:00'),end:stamp(date,'12:00')})).status,409);
   assert.equal((await command(admin,{...save,date:next,previousDate:date})).status,201);
   assert.deepEqual((await store.read()).state.holidays,[next]);
   assert.deepEqual((await store.read()).state.settings?.holidayPosters,{[next]:poster});
   for(const client of [student,staff]) assert.equal((await command(client,{type:'HOLIDAY_DELETE',date:next})).status,403);
   assert.equal((await command(admin,{type:'HOLIDAY_DELETE',date:next})).status,201);
   assert.deepEqual((await store.read()).state.holidays,[]);
   assert.deepEqual((await store.read()).state.settings?.holidayPosters,{});
   assert.equal((await command(admin,{type:'HOLIDAY_DELETE',date:next})).status,409);
  });
  await t.test('admin deactivation revokes an existing session and the admin cannot lock itself out',async()=>{
   assert.equal((await call('/admin/access',{method:'POST',headers:headers(student),body:JSON.stringify({userId:4,role:'ADMIN',roomIds:[],active:true})})).status,403);
   assert.equal((await call('/admin/access',{method:'POST',headers:headers(admin),body:JSON.stringify({userId:3,role:'USER',roomIds:[],active:true})})).status,400);
   assert.equal((await call('/admin/access',{method:'POST',headers:headers(admin),body:JSON.stringify({userId:4,role:'USER',roomIds:[],active:false})})).status,201);
   assert.equal((await call('/state',{headers:{cookie:other.cookie}})).status,401);
  });
  await t.test('logout invalidates the server session',async()=>{
   assert.equal((await call('/auth/logout',{method:'POST',headers:{...headers(student),'x-csrf-token':'invalid'}})).status,403);
   assert.equal((await call('/auth/logout',{method:'POST',headers:headers(student)})).status,201);
   assert.equal((await call('/state',{headers:{cookie:student.cookie}})).status,401);
   assert.equal((await call('/auth/logout',{method:'POST',headers:headers(student)})).status,201);
   const expired=await login(1);
   await store.transaction(data=>{for(const session of data.sessions)if(session.userId===1)session.expiresAt='2000-01-01T00:00:00Z';});
   assert.equal((await call('/auth/logout',{method:'POST',headers:headers(expired)})).status,201);
   assert.equal((await store.read()).sessions.some(s=>s.userId===1),false);
   assert.equal((await call('/auth/logout',{method:'POST',headers:headers(other)})).status,201);
   assert.equal((await call('/auth/logout',{method:'POST'})).status,201);
   assert.equal((await call('/auth/logout',{method:'POST',headers:{origin:'https://other.example'}})).status,403);
  });
 }finally{await app.close();await store.close();await rm(dir,{recursive:true,force:true});}
});

test('late-cancel violation and rejected idempotency result survive a database restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kku-late-cancel-')),path=join(dir,'store.sqlite');
 const initial=fixture();initial.state.bookings=[createSeed().bookings.find(b=>b.id===1)!];
 let store=new SqliteStore(path,initial);
 const cancel={type:'CANCEL',bookingId:1},key='late-cancel-durable-key',now='2026-10-08T08:00:00+07:00';
 try {
  const rejected=await store.transaction(d=>applyCommand(d,1,cancel,key,now));
  assert.ok(rejected instanceof ConflictException);
  await store.close();store=new SqliteStore(path);
  const persisted=await store.read();
  assert.equal(persisted.state.violations.filter(v=>v.type==='LATE_CANCEL').length,1);
  assert.equal(persisted.state.bookings[0].status,'APPROVED');
  const repeated=await store.transaction(d=>applyCommand(d,1,cancel,key,now));
  assert.ok(repeated instanceof ConflictException);
  assert.deepEqual((await store.read()).state,persisted.state);
  // Unrelated failures must still roll back every change in the transaction.
  await assert.rejects(store.transaction(d=>{d.state.users[0].name='must roll back';return applyCommand(d,4,cancel,'foreign-cancel-key-01',now);}));
  assert.deepEqual((await store.read()).state,persisted.state);
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
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
test('Google default policy accepts only verified KKU domains and rejects lookalikes before changing identity',()=>{
 const c=readConfig({}),d=emptyData(),now=new Date().toISOString();
 assert.equal(c.allowPublicGoogle,false);
 assert.deepEqual(c.allowedDomains,['kkumail.com','kku.ac.th']);
 const student=linkGoogle(d,{sub:'student',email:'Student@KKUMAIL.COM',email_verified:true,hd:'KKUMAIL.COM'},c,now);
 const staff=linkGoogle(d,{sub:'staff',email:'staff@kku.ac.th',email_verified:true,hd:'kku.ac.th'},c,now);
 assert.equal(student.email,'student@kkumail.com');assert.equal(staff.role,'USER');
 for(const [email,hd] of [['outside@gmail.com','gmail.com'],['fake@kkumail.com.evil.test','kkumail.com'],['fake@sub.kku.ac.th','kku.ac.th'],['fake@kkumail.com','evil.test'],['fake@kkumail.com',''],['fake@evil.test@kkumail.com','kkumail.com']]) {
  assert.throws(()=>linkGoogle(d,{sub:'student',email,email_verified:true,hd},c,now));
 }
 assert.throws(()=>linkGoogle(d,{sub:'unverified',email:'student2@kkumail.com',email_verified:false,hd:'kkumail.com'},c,now));
 assert.equal(d.state.users.length,2);assert.equal(d.identities.length,2);
 assert.equal(student.email,'student@kkumail.com');
});
test('production refuses development login, missing config, insecure origins and SQLite',()=>{
 assert.throws(()=>readConfig({NODE_ENV:'production',DEV_LOGIN:'1'}));
 assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'http://example.com'}));
 assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'https://example.com',DB_DRIVER:'sqlite'}));
 assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'https://example.com'}));
});
