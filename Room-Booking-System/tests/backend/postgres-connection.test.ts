import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Pool } from 'pg';
import { PostgresStore, tables } from '../../apps/backend/src/infrastructure/postgres-store';

for (const operation of ['read', 'transaction'] as const) {
 test(`${operation} survives socket reset, discards client and permits the next request`, async () => {
  const reset = Object.assign(new Error('connection reset'), {code:'ECONNRESET'});
  let connections = 0;
  const released: boolean[] = [];
  const clients: EventEmitter[] = [];
  const pool = {
   connect: async () => {
    const fail = connections++ === 0;
    const client = Object.assign(new EventEmitter(), {
     query: async (sql:string) => {
      if (fail && sql.startsWith('SELECT pg_catalog.set_config')) {
       client.emit('error', reset);
       throw reset;
      }
      if (fail && sql === 'ROLLBACK') throw new Error('rollback on disconnected client');
      return { rows: [] };
     },
     release: (destroy:boolean) => {released.push(destroy);},
    });
    clients.push(client);
    return client;
   },
  } as unknown as Pool;
  const store = new PostgresStore({databaseUrl:''}, pool);
  const run = () => operation === 'read' ? store.read() : store.transaction(()=> 'ok');
  await assert.rejects(run(), error => error === reset);
  await run();
  assert.deepEqual(released, [true, false]);
  assert.equal(clients[0].listenerCount('error'), 0);
  assert.equal(clients[1].listenerCount('error'), 0);
 });
}

test('ordinary transaction rejection rolls back without destroying a healthy client', async()=>{
 const original = new Error('validation failed');
 const queries:string[] = [];
 let destroyed: boolean | undefined;
 const client = Object.assign(new EventEmitter(), {
  query: async(sql:string)=>{queries.push(sql);return {rows:[]};},
  release:(broken:boolean)=>{destroyed=broken;},
 });
 const store = new PostgresStore({databaseUrl:''}, {connect:async()=>client} as unknown as Pool);
 await assert.rejects(store.transaction(()=>{throw original;}), error=>error===original);
 assert.equal(queries.at(-1), 'ROLLBACK');
 assert.equal(destroyed, false);
});

test('loads all tables in one query and preserves settings, auth rows and history order', async()=>{
 const queries:string[]=[];
 const client=Object.assign(new EventEmitter(), {
  query:async(sql:string)=>{
   queries.push(sql);
   return {rows:sql.includes('UNION ALL')?[
    {table_name:'settings',payload:{contactEmail:'desk@example.com',contactPhone:'',faqs:[]}},
    {table_name:'holidays',payload:'2026-10-20'},
    {table_name:'sessions',payload:{hash:'session',userId:1,csrf:'csrf',expiresAt:'2030-01-01T00:00:00Z'}},
    {table_name:'password_tokens',payload:{tokenHash:'token'}},
    {table_name:'bookings',payload:{id:1}},
    {table_name:'bookings',payload:{id:2}},
   ]:[]};
  },release:()=>{},
 });
 const store=new PostgresStore({databaseUrl:''},{connect:async()=>client} as unknown as Pool);
 const data=await store.read();
 const reads=queries.filter(sql=>sql.includes('UNION ALL'));
 assert.equal(reads.length,1);
 assert.equal(reads[0].split(' UNION ALL ').length,tables.length);
 assert.equal(data.state.settings?.contactEmail,'desk@example.com');
 assert.deepEqual(data.state.holidays,['2026-10-20']);
 assert.equal(data.sessions[0].hash,'session');
 assert.equal(data.passwordTokens[0].tokenHash,'token');
 assert.deepEqual(data.state.bookings.map(b=>b.id),[2,1]);
 assert.deepEqual(data.state.rooms,[]);
});
