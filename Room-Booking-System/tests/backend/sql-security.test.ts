import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import type { Pool } from 'pg';
import { PostgresStore, tableIdentifier, tables } from '../../apps/backend/src/infrastructure/postgres-store';
import { SqliteStore } from '../../apps/backend/src/infrastructure/sqlite-store';
import { createSeed } from '../../apps/web/src/lib/seed';
import { emptyData } from '../../apps/backend/src/infrastructure/store';
import { applyCommand } from '../../apps/backend/src/modules/booking-service';
import { addDays, dateOf, stamp } from '../../packages/core/src/domain';
import { createApplication } from '../../apps/backend/src/main';
import { readConfig } from '../../apps/backend/src/common/config';
import { testSession } from './session-fixture';

const migrations=['202610080001_server_storage','202610090001_password_auth','20261009171230_audit_settings','20261011184944_sql_security_hardening'];
const attacks=["' OR '1'='1", "'); DROP TABLE kku_private.users; --", "'; SELECT pg_sleep(10); --", "O'Connor ภาษาไทย ; --"];
async function fixture() {
 const db=await PGlite.create({extensions:{btree_gist}});
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE kku_server LOGIN; CREATE SCHEMA extensions;');
 for(const name of migrations)await db.exec(await readFile(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
 const client={query:(sql:string,args?:unknown[])=>db.query(sql,args),release:()=>{}};
 const store=new PostgresStore({databaseUrl:''},{connect:async()=>client,end:()=>db.close()} as unknown as Pool);
 await db.exec('SET ROLE kku_server');
 await store.transaction(d=>{const seed=createSeed();d.state.users=seed.users;d.state.buildings=seed.buildings;d.state.rooms=seed.rooms;d.state.equipment=seed.equipment;d.state.assignments=seed.assignments;});
 return {db,store};
}

test('PostgreSQL binds hostile values and keys on insert, update, read and delete',async()=>{
 const {db,store}=await fixture();
 try {
  const tomorrow=addDays(dateOf(new Date().toISOString()),1);
  for(const [i,attack] of attacks.entries()) {
   await store.transaction(d=>{d.state.users[0].name=attack;d.sessions.push({hash:attack,userId:1,csrf:'csrf',expiresAt:'2030-01-01T00:00:00Z'});});
   const saved=await store.read();assert.equal(saved.state.users[0].name,attack);assert.ok(saved.sessions.some(s=>s.hash===attack));
   assert.equal(saved.state.users.length,createSeed().users.length);
   await store.transaction(d=>applyCommand(d,1,{type:'SUPPORT_REQUEST',question:attack},`sql-injection-help-${i}`,new Date().toISOString()));
   assert.ok((await store.read()).state.messages.some(m=>m.question===attack));
   await store.transaction(d=>{d.sessions=d.sessions.filter(s=>s.hash!==attack);});
   assert.ok(!(await store.read()).sessions.some(s=>s.hash===attack));
  }
  await store.transaction(d=>applyCommand(d,1,{type:'BOOK',roomId:1,start:stamp(tomorrow,'10:00'),end:stamp(tomorrow,'11:00'),purpose:attacks[1],attendees:2,participants:[],equipment:[]},'sql-injection-booking-01',new Date().toISOString()));
  const saved=await store.read();assert.equal(saved.state.bookings[0].purpose,attacks[1]);
  assert.equal((await db.query<{n:number}>('SELECT count(*)::int AS n FROM kku_private.users')).rows[0].n,createSeed().users.length);
 } finally {await store.close();}
});

test('PostgreSQL runtime can use the adapter, but cannot own, truncate or change schema; browsers cannot read private data',async()=>{
 const {db,store}=await fixture();
 try {
  const flags=await db.query<{owns:boolean;creates:boolean;truncates:boolean}>(`SELECT
   pg_has_role(current_user,(SELECT relowner FROM pg_class WHERE oid='kku_private.users'::regclass),'USAGE') AS owns,
   has_schema_privilege('kku_private','CREATE') AS creates,has_table_privilege('kku_private.users','TRUNCATE') AS truncates`);
  assert.deepEqual(flags.rows[0],{owns:false,creates:false,truncates:false});
  for(const sql of ['TRUNCATE kku_private.users','ALTER TABLE kku_private.users DISABLE ROW LEVEL SECURITY','CREATE TABLE kku_private.attacker(id int)','DROP TABLE kku_private.settings']) {
   await assert.rejects(db.exec(sql),e=>(e as {code:string}).code==='42501');
  }
  for(const role of ['anon','authenticated']) {
   await db.exec(`SET ROLE ${role}`);
   await assert.rejects(db.query('SELECT payload FROM kku_private.credentials'),e=>(e as {code:string}).code==='42501');
  }
  await db.exec('RESET ROLE');
  const policy=await db.query<{n:number}>("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='kku_private' AND policyname='server_access' AND roles=ARRAY['kku_server']::name[]");
  assert.equal(policy.rows[0].n,23);
 } finally {await store.close();}
});

test('database constraints reject missing JSON fields, impossible stock, mismatched times and reopened terminal bookings',async()=>{
 const {db,store}=await fixture();
 try {
  const invalid=[
   ['credentials','1',{}],['credentials','1',{userId:1,passwordHash:null}],
   ['password_tokens','bad',{}],['password_tokens','bad',{tokenHash:'bad',kind:'register',email:'a@example.com',expiresAt:'2030-01-01'}],
   ['users','90',{id:90,email:null,role:'USER',active:true}],
   ['equipment','90',{id:90,total:1,remaining:2}],['rooms','90',{id:90,code:'X',capacity:null,floor:1,status:'AVAILABLE',buildingId:1}],
  ] as const;
  for(const [table,key,payload] of invalid)await assert.rejects(db.query(`INSERT INTO ${tableIdentifier(table)}(key,payload) VALUES($1,$2::jsonb)`,[key,JSON.stringify(payload)]),e=>(e as {code:string}).code==='23514');
  const tomorrow=addDays(dateOf(new Date().toISOString()),1),start=stamp(tomorrow,'10:00'),end=stamp(tomorrow,'11:00');
  const book={type:'BOOK',roomId:1,start,end,purpose:'constraint test',attendees:2,participants:[],equipment:[]};
  await store.transaction(d=>applyCommand(d,1,book,'constraint-booking-01',new Date().toISOString()));
  const id=(await store.read()).state.bookings[0].id;
  await assert.rejects(db.query("UPDATE kku_private.bookings SET payload=jsonb_set(payload,'{start}',to_jsonb($1::text)) WHERE key=$2",[stamp(tomorrow,'12:00'),String(id)]));
  await store.transaction(d=>{d.state.bookings[0].status='CANCELLED';});
  await assert.rejects(store.transaction(d=>{d.state.bookings[0].status='PENDING';}),e=>(e as {code:string}).code==='23514');
  assert.equal((await store.read()).state.bookings[0].status,'CANCELLED');
 } finally {await store.close();}
});

test('identifier allowlist rejects identifiers even if TypeScript is bypassed',()=>{
 assert.equal(Object.isFrozen(tables),true);
 for(const value of [...attacks,'users; DROP TABLE users','users"','public.users','__proto__','app_lock'])assert.throws(()=>tableIdentifier(value));
});

test('SQLite prepared statements retain hostile values without changing other rows',async()=>{
 const data=emptyData();data.state.users=createSeed().users;
 const store=new SqliteStore(':memory:',data);
 try {for(const attack of attacks){await store.transaction(d=>{d.state.users[0].name=attack;});const saved=await store.read();assert.equal(saved.state.users[0].name,attack);assert.equal(saved.state.users.length,data.state.users.length);}}finally{await store.close();}
});

test('HTTP rejects SQL strings in numeric IDs and extra SQL fields before any writes',async()=>{
 const data=emptyData();data.state.users=createSeed().users;
 const store=new SqliteStore(':memory:',data),c=readConfig({APP_ORIGIN:'http://127.0.0.1:5174'});
 const app=await createApplication(store,c);await app.listen(0,'127.0.0.1');
 try {
  const session=await testSession(store,c,1),before=await store.read();
  for(const body of [{type:'CANCEL',bookingId:attacks[0]},{type:'PROFILE',name:'test',phone:'0812345678',sql:attacks[1]},{type:'CANCEL',bookingId:1,table:attacks[1]}]) {
   const response=await fetch(`${await app.getUrl()}/api/commands`,{method:'POST',headers:{'content-type':'application/json',origin:c.origin,cookie:session.cookie,'x-csrf-token':session.body.csrfToken,'idempotency-key':'sql-invalid-input-key-01'},body:JSON.stringify(body)});
   assert.equal(response.status,400);assert.ok(!JSON.stringify(await response.json()).includes('kku_private'));
  }
  assert.deepEqual(await store.read(),before);
 }finally{await app.close();await store.close();}
});
