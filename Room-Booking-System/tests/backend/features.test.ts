import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../../apps/backend/src/main';
import { readConfig, mailConfigured } from '../../apps/backend/src/common/config';
import { SqliteStore } from '../../apps/backend/src/infrastructure/sqlite-store';
import { emptyData } from '../../apps/backend/src/infrastructure/store';
import { createSeed } from '../../apps/web/src/lib/seed';
import { testSession } from './session-fixture';
import { applyCommand } from '../../apps/backend/src/modules/booking-service';
import { claimMail, finishMail } from '../../apps/backend/src/modules/jobs';
import { commandSchema } from '../../apps/backend/src/common/validation';

test('room photos accept installed raster assets and reject traversal or executable image paths',()=>{
 const room=createSeed().rooms[0];
 assert.equal(commandSchema.safeParse({type:'ROOM_SAVE',room:{...room,imageUrl:'/room-images/meeting-illustrative.png'}}).success,true);
 for(const imageUrl of ['/room-images/../private.png','/room-images/%2e%2e/private.png','/room-images/test.svg','//evil.example/test.png','/private/test.png','http://example.com/test.png'])assert.equal(commandSchema.safeParse({type:'ROOM_SAVE',room:{...room,imageUrl}}).success,false);
});

test('production can serve search while SMTP is unconfigured',()=>{
 const c=readConfig({VERCEL:'1',APP_ORIGIN:'https://rooms.example.com',DATABASE_URL:'postgres://fixture',CRON_SECRET:'c'.repeat(32),RATE_LIMIT_SECRET:'r'.repeat(32)});
 assert.equal(c.production,true);assert.equal(mailConfigured(c),false);
});

test('public catalog applies elapsed booking lifecycle once before showing availability',async()=>{
 const data=emptyData();data.state=createSeed();
 const booking=data.state.bookings.find(b=>b.status==='APPROVED')!;
 booking.start=new Date(Date.now()-3600000).toISOString();booking.end=new Date(Date.now()+3600000).toISOString();
 const store=new SqliteStore(':memory:',data),app=await createApplication(store,readConfig({}));
 await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 try{
  const response=await fetch(base+'/api/public/catalog');assert.equal(response.status,200);
  const first=await store.read();assert.equal(first.state.bookings.find(b=>b.id===booking.id)?.status,'NO_SHOW');
  assert.equal(first.state.violations.filter(v=>v.bookingId===booking.id&&v.type==='NO_SHOW').length,1);
  await fetch(base+'/api/public/catalog');const second=await store.read();
  assert.equal(second.outbox.length,first.outbox.length);assert.equal(second.state.violations.length,first.state.violations.length);
 }finally{await app.close();await store.close();}
});

test('HTTP floor changes persist, reject user access, and manual email requires configured SMTP',async()=>{
 const data=emptyData();data.state=createSeed();
 const c=readConfig({APP_ORIGIN:'http://127.0.0.1:3179'}),store=new SqliteStore(':memory:',data);
 const app=await createApplication(store,c);await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 try {
  const admin=await testSession(store,c,3),user=await testSession(store,c,1);
  const call=(body:unknown,session:typeof user)=>fetch(base+'/api/commands',{method:'POST',headers:{origin:c.origin,'content-type':'application/json',cookie:session.cookie,'x-csrf-token':session.body.csrfToken,'idempotency-key':randomUUID()},body:JSON.stringify(body)});
  const floor={type:'FLOOR_SAVE',buildingId:1,number:6,name:'พื้นที่ประชุมใหม่'};
  assert.equal((await call(floor,user)).status,403);
  assert.equal((await call(floor,admin)).status,201);
  assert.equal((await store.read()).state.buildings.find(b=>b.id===1)?.levels?.find(f=>f.number===6)?.name,floor.name);
  const config=await(await fetch(base+'/api/config')).json();assert.equal(config.emailReady,false);
  const queuedBefore=(await store.read()).outbox.length;
  const email={type:'SEND_NOTICE',recipientEmail:data.state.users.find(u=>u.id===1)!.email,notificationType:'GENERAL',message:'ทดสอบ'};
  assert.equal((await call(email,admin)).status,400);
  assert.equal((await store.read()).outbox.length,queuedBefore);
  // Configure an inert SMTP host; queue only, no worker or network delivery.
  c.smtpHost='smtp.invalid';c.smtpUser='resend';c.mailFrom='booking@example.com';
  assert.equal(mailConfigured(c),false);c.smtpPassword='local-test-key';assert.equal(mailConfigured(c),true);
  assert.equal((await call(email,admin)).status,201);
  assert.equal((await store.read()).outbox.length,queuedBefore+1);
  assert.equal((await call({...email,recipientEmail:'unregistered@example.com'},admin)).status,403);
 }finally{await app.close();await store.close();}
});

test('mail delivery results survive persistence and permanent failures do not retry',()=>{
 const data=emptyData();data.state=createSeed();const now=data.state.now;
 applyCommand(data,3,{type:'SEND_NOTICE',recipientEmail:data.state.users[0].email,notificationType:'GENERAL',message:'ทดสอบ'},randomUUID(),now);
 const mail=claimMail(data,now)!;assert.ok(mail);
 finishMail(data,mail.notice.id,mail.token,now,true);
 const notice=data.state.notices.find(n=>n.id===mail.notice.id)!;
 assert.equal(notice.status,'SENT');assert.equal(notice.sentAt,now);assert.equal(notice.attempts,1);
 applyCommand(data,3,{type:'SEND_NOTICE',recipientEmail:data.state.users[0].email,notificationType:'GENERAL',message:'ทดสอบอีกครั้ง'},randomUUID(),now);
 const second=claimMail(data,now)!;finishMail(data,second.notice.id,second.token,now,false,'โดเมนไม่ได้รับอนุญาต');
 assert.equal(data.state.notices.find(n=>n.id===second.notice.id)?.deliveryError,'โดเมนไม่ได้รับอนุญาต');
 assert.equal(data.state.notices.find(n=>n.id===second.notice.id)?.status,'FAILED');
 assert.equal(claimMail(data,new Date(Date.parse(now)+86400000).toISOString()),null);
});
