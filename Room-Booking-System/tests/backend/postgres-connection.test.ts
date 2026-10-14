import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Pool } from 'pg';
import { PostgresStore } from '../../apps/backend/src/infrastructure/postgres-store';

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
      if (fail && sql.startsWith('SET LOCAL search_path')) {
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
