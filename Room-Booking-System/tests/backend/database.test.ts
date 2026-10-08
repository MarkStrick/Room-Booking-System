import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import type { Pool } from 'pg';
import { PostgresStore } from '../../apps/backend/src/infrastructure/postgres-store';
import { createSeed } from '../../apps/web/src/lib/seed';
import { addDays, dateOf, stamp } from '../../packages/core/src/domain';
import { applyCommand } from '../../apps/backend/src/modules/booking-service';
import { hashPassword,verifyPassword } from '../../apps/backend/src/modules/password-hash';
test('Supabase migration parses in PostgreSQL: overlap constraints and browser isolation',async()=>{
 const db=await PGlite.create({extensions:{btree_gist}});
 try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA extensions;');
  const sql=await readFile(new URL('../../supabase/migrations/202610080001_server_storage.sql',import.meta.url),'utf8');
  await db.exec(sql);
  await db.exec(await readFile(new URL('../../supabase/migrations/202610090001_password_auth.sql',import.meta.url),'utf8'));
  await db.query(`INSERT INTO kku_private.users(key,payload) VALUES('1',$1::jsonb)`,[JSON.stringify({id:1,email:'test@example.edu'})]);
  await db.query(`INSERT INTO kku_private.rooms(key,payload) VALUES('1',$1::jsonb)`,[JSON.stringify({id:1,code:'A-1'})]);
  async function book(id:number,start:string,end:string,status='PENDING') {
   await db.query('INSERT INTO kku_private.bookings(key,payload,user_key,room_key,start_at,end_at,status) VALUES($1,$2::jsonb,$3,$4,$5,$6,$7)',[String(id),JSON.stringify({id,roomId:1,userId:1,status}),'1','1',start,end,status]);
  }
  await book(1,'2026-10-09T10:00:00+07:00','2026-10-09T12:00:00+07:00');
  await assert.rejects(book(2,'2026-10-09T11:00:00+07:00','2026-10-09T13:00:00+07:00'),e=>(e as {code:string}).code==='23P01');
  await book(3,'2026-10-09T12:00:00+07:00','2026-10-09T13:00:00+07:00');
  await book(4,'2026-10-09T11:00:00+07:00','2026-10-09T13:00:00+07:00','CANCELLED');
  const permissions=await db.query<{schema_allowed:boolean;table_allowed:boolean}>(`SELECT has_schema_privilege('anon','kku_private','USAGE') AS schema_allowed,has_table_privilege('authenticated','kku_private.sessions','SELECT') AS table_allowed`);
  assert.equal(permissions.rows[0].schema_allowed,false);assert.equal(permissions.rows[0].table_allowed,false);
  const rls=await db.query<{count:number}>(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='kku_private' AND c.relkind='r' AND c.relrowsecurity=true`);
  assert.equal(rls.rows[0].count,22);
  assert.equal((await db.query<{allowed:boolean}>("SELECT has_table_privilege('authenticated','kku_private.credentials','SELECT') AS allowed")).rows[0].allowed,false);
  await assert.rejects(db.query("INSERT INTO kku_private.credentials(key,payload) VALUES('1',$1::jsonb)",[JSON.stringify({userId:1,passwordHash:'plaintext'})]));
 }finally{await db.close();}
});
test('Postgres adapter persists transactions, server sessions and outbox; errors roll back',async()=>{
 const db=await PGlite.create({extensions:{btree_gist}});
 // Real PostgreSQL engine with an in-process transport; cloud TLS is tested separately at setup.
 const client={query:(sql:string,args?:unknown[])=>db.query(sql,args),release:()=>{}};
 const pool={connect:async()=>client,end:()=>db.close()} as unknown as Pool;
 const store=new PostgresStore({databaseUrl:'',databaseCa:undefined},pool);
 try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA extensions;');
  await db.exec(await readFile(new URL('../../supabase/migrations/202610080001_server_storage.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/202610090001_password_auth.sql',import.meta.url),'utf8'));
  await store.transaction(d=>{const sample=createSeed();d.state.users=sample.users;d.state.rooms=sample.rooms;d.state.buildings=sample.buildings;d.state.equipment=sample.equipment;d.state.assignments=sample.assignments;d.state.holidays=['2030-01-01'];d.sessions.push({hash:'test-session',userId:1,csrf:'test-csrf',expiresAt:'2030-01-01T00:00:00.000Z'});});
  const passwordHash=await hashPassword('Postgres test passphrase');
  await store.transaction(d=>{d.credentials.push({userId:1,passwordHash,failedAttempts:0,updatedAt:new Date().toISOString()});d.passwordTokens.push({tokenHash:'test-token-hash',kind:'reset',email:d.state.users[0].email,userId:1,expiresAt:'2030-01-01T00:00:00Z'});});
  const tomorrow=addDays(dateOf(new Date().toISOString()),1);
  await store.transaction(d=>applyCommand(d,1,{type:'BOOK',roomId:1,start:stamp(tomorrow,'10:00'),end:stamp(tomorrow,'11:00'),attendees:2,purpose:'persistent booking',participants:[],equipment:[{id:1,qty:1}]},'adapter-booking-key-01',new Date().toISOString()));
  const saved=await store.read();
  assert.equal(saved.state.bookings.length,1);assert.ok(saved.outbox.length>0);assert.equal(saved.outbox.length,saved.state.notices.length);assert.equal(saved.sessions[0].hash,'test-session');assert.deepEqual(saved.state.holidays,['2030-01-01']);
  assert.equal(await verifyPassword(saved.credentials[0].passwordHash,'Postgres test passphrase'),true);assert.equal(saved.passwordTokens[0].tokenHash,'test-token-hash');
  await assert.rejects(store.transaction(d=>{d.state.rooms[0].name='should roll back';throw new Error('transaction failed');}));
  assert.notEqual((await store.read()).state.rooms[0].name,'should roll back');
  await store.transaction(d=>{d.sessions=[];d.state.bookings[0].status='CANCELLED';});
  assert.equal((await store.read()).sessions.length,0);
  assert.equal((await db.query<{status:string}>('SELECT status FROM kku_private.bookings')).rows[0].status,'CANCELLED');
 }finally{await store.close();}
});
