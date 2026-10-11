import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from '../../apps/backend/src/infrastructure/sqlite-store';
import { emptyData } from '../../apps/backend/src/infrastructure/store';
import { readConfig } from '../../apps/backend/src/common/config';
import { createApplication } from '../../apps/backend/src/main';
import { createStore } from '../../apps/backend/src/infrastructure/create-store';
import { authClientAddress, consumeAuthLimit } from '../../apps/backend/src/common/shared-auth-limit';
import { createSeed } from '../../apps/web/src/lib/seed';
import { testSession } from './session-fixture';
import type { Request } from 'express';
import { bootstrapFirstAdmin } from '../../apps/backend/src/modules/admin-bootstrap';
import { verifyPassword } from '../../apps/backend/src/modules/password-hash';

test('test tools and readiness require a live ADMIN; removed test login cannot create sessions', async () => {
 const d=emptyData();d.state.users=createSeed().users;
 const store=new SqliteStore(':memory:',d),c=readConfig({APP_ORIGIN:'http://127.0.0.1:5174',DEV_LOGIN:'1'});
 const app=await createApplication(store,c);await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 const get=(path:string,cookie='')=>fetch(`${base}/api${path}`,{headers:{cookie}});
 try {
  const admin=await testSession(store,c,3),student=await testSession(store,c,1),staff=await testSession(store,c,2);
  const before=await store.read();
  for(const path of ['/admin/test-tools','/admin/readiness']) {
   assert.equal((await get(path)).status,401);
   for(const client of [student,staff])assert.equal((await get(path,client.cookie)).status,403);
   assert.equal((await get(path,admin.cookie)).status,200);
  }
  assert.deepEqual(await store.read(),before);
  const config=await (await get('/config')).json();assert.ok(!('devLogin' in config));assert.equal(config.googleReady,false);assert.equal(config.registrationReady,false);
  for(const cookie of ['',student.cookie,admin.cookie]) {
   const res=await fetch(`${base}/api/auth/development`,{method:'POST',headers:{cookie,'content-type':'application/json',origin:c.origin},body:JSON.stringify({userId:3})});
   assert.equal(res.status,403);assert.equal(res.headers.get('set-cookie'),null);
  }
  const readiness=await (await get('/admin/readiness',admin.cookie)).json();assert.equal(readiness.ready,false);
  assert.ok(!JSON.stringify(readiness).includes('passwordHash'));
  await store.transaction(data=>{data.state.users.find(u=>u.id===3)!.role='USER';});
  assert.equal((await get('/admin/test-tools',admin.cookie)).status,403);
  await store.transaction(data=>{data.state.users.find(u=>u.id===3)!.active=false;});
  assert.equal((await get('/admin/test-tools',admin.cookie)).status,401);
 }finally{await app.close();await store.close();}
});

test('scheduled jobs reject missing/incorrect secrets before writes; repeat runs are safe',async()=>{
 const store=new SqliteStore(':memory:'),c={...readConfig({}),cronSecret:'test-only-cron-secret-000000000000000000'};
 const app=await createApplication(store,c);await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 const call=(secret='')=>fetch(`${base}/api/internal/jobs`,{headers:{authorization:secret}});
 try {
  const before=await store.read();
  for(const value of ['','Bearer wrong','Bearer รหัสผิด']) {
   // HTTP header values must be ASCII; non-ASCII is tested by service comparison elsewhere.
   if(value.includes('ร'))continue;
   assert.equal((await call(value)).status,403);
  }
  assert.deepEqual(await store.read(),before);
  for(let i=0;i<2;i++){const res=await call(`Bearer ${c.cronSecret}`);assert.equal(res.status,200);assert.equal((await res.json()).emailConfigured,false);}
  const data=await store.read();assert.ok(data.state.settings?.workerAt);assert.equal(data.state.notices.length,0);assert.equal(data.outbox.length,0);
 }finally{await app.close();await store.close();}
});

test('shared login limiter serializes concurrent requests and survives restart without retaining IPs',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kku-rate-')),file=join(dir,'rate.sqlite');
 let store=new SqliteStore(file);const now=Date.now(),secret='test-secret-000000000000000000000000000';
 try {
  const results=await Promise.all(Array.from({length:25},()=>consumeAuthLimit(store,'203.0.113.7',secret,now)));
  assert.equal(results.filter(r=>r.allowed).length,20);
  assert.ok(!JSON.stringify(await store.read()).includes('203.0.113.7'));
  await store.close();store=new SqliteStore(file);
  assert.equal((await consumeAuthLimit(store,'203.0.113.7',secret,now+500)).allowed,false);
  assert.equal((await consumeAuthLimit(store,'203.0.113.8',secret,now+500)).allowed,true);
  assert.equal((await consumeAuthLimit(store,'203.0.113.7',secret,now+60001)).allowed,true);
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});

test('direct hosts ignore forged forwarded IPs; Vercel configuration enforces real production settings',()=>{
 const req={get:()=> '203.0.113.9',ip:'127.0.0.1',socket:{}} as unknown as Request,c=readConfig({});
 assert.equal(authClientAddress(req,c),'127.0.0.1');assert.equal(authClientAddress(req,{...c,serverless:true}),'203.0.113.9');
 const base={VERCEL:'1',NODE_ENV:'development',APP_ORIGIN:'https://rooms.example.com',DATABASE_URL:'postgres://test',SMTP_HOST:'test',MAIL_FROM:'test@example.com',CRON_SECRET:'x'.repeat(32),RATE_LIMIT_SECRET:'y'.repeat(32)};
 assert.equal(readConfig(base).production,true);
 assert.throws(()=>readConfig({...base,DEV_LOGIN:'1'}));
 assert.throws(()=>readConfig({...base,DB_DRIVER:'sqlite'}));
 assert.throws(()=>readConfig({...base,CRON_SECRET:''}));
 assert.throws(()=>readConfig({...base,DATABASE_CA_PATH:'C:/local/certificate.pem'}));
});

test('application startup never seeds public sample accounts even with the obsolete flag',async()=>{
 const store=await createStore({...readConfig({DEV_LOGIN:'1'}),dbFile:':memory:'});
 try{assert.equal((await store.read()).state.users.length,0);assert.equal((await store.read()).state.rooms.length,0);}finally{await store.close();}
});

test('first-admin bootstrap requires server allowlist, hashes the password and refuses overwriting accounts',async()=>{
 const store=new SqliteStore(':memory:'),c=readConfig({BOOTSTRAP_ADMIN_EMAILS:'operator@example.com'}),password='Bootstrap test passphrase 2026';
 try {
  await assert.rejects(bootstrapFirstAdmin(store,c,'outsider@example.com',password));
  assert.equal((await store.read()).state.users.length,0);
  await bootstrapFirstAdmin(store,c,'operator@example.com',password);
  const data=await store.read();assert.equal(data.state.users[0].role,'ADMIN');
  assert.ok(await verifyPassword(data.credentials[0].passwordHash,password));
  assert.ok(!JSON.stringify(data).includes(password));
  await assert.rejects(bootstrapFirstAdmin(store,c,'operator@example.com',password));
  assert.equal((await store.read()).state.users.length,1);
 }finally{await store.close();}
});
