import { readFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import type { Config } from '../common/config';
import type { Data, Store } from './store';
import { emptyData } from './store';
export const tables = ['users','buildings','rooms','equipment','bookings','notices','violations','penalties','closures','inspections','messages','audit','holidays','assignments','identities','sessions','attempts','outbox','flows','credentials','password_tokens'] as const;
type Table = typeof tables[number];
const stateTables=new Set<string>(tables.slice(0,14));
function rows(data:Data,table:Table):unknown[] {
 if(table==='password_tokens')return data.passwordTokens;
 return stateTables.has(table)?(data.state as unknown as Record<string,unknown[]>)[table]:(data as unknown as Record<string,unknown[]>)[table];
}
function key(table:Table,row:unknown):string {
 if(table==='holidays')return row as string;
 const r=row as Record<string,unknown>;
 if(table==='identities')return String(r.subject);
 if(table==='sessions'||table==='flows')return String(r.hash);
 if(table==='password_tokens')return String(r.tokenHash);
 if(table==='attempts')return `${r.actorId}:${r.key}`;
 if(table==='outbox')return String(r.noticeId);
 if(table==='assignments'||table==='credentials')return String(r.userId);
 return String(r.id);
}
async function load(client:PoolClient):Promise<Data> {
 const data=emptyData();
 for(const table of tables) {
  const result=await client.query(`SELECT payload FROM kku_private.${table} ORDER BY key`);
  const target=stateTables.has(table)?data.state:data;
  (target as unknown as Record<string,unknown>)[table==='password_tokens'?'passwordTokens':table]=result.rows.map(r=>r.payload);
 }
 for(const name of ['bookings','notices','inspections','audit'] as const)data.state[name].sort((a,b)=>b.id-a.id);
 return data;
}
export class PostgresStore implements Store {
 readonly pool:Pool;
 constructor(c:Pick<Config,'databaseUrl'|'databaseCa'>,pool?:Pool) {
  if(pool){this.pool=pool;return;}
  if(!c.databaseUrl)throw new Error('DATABASE_URL is required for Supabase');
  const url=new URL(c.databaseUrl);
  // Prevent URL sslmode from replacing strict TLS validation in node-postgres.
  for(const param of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(param);
  this.pool=new Pool({connectionString:url.toString(),max:8,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,ssl:{rejectUnauthorized:true,...(c.databaseCa?{ca:readFileSync(c.databaseCa,'utf8')}:{})}});
  this.pool.on('error',e=>console.error(JSON.stringify({event:'database_pool_error',code:(e as {code?:string}).code??'CONNECTION_ERROR'})));
 }
 async read():Promise<Data> {
  const client=await this.pool.connect();
  try {await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await load(client);await client.query('COMMIT');return data;}
  catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async transaction<T>(fn:(data:Data)=>T):Promise<T> {
  const client=await this.pool.connect();
  try {
   await client.query('BEGIN');
   await client.query("SET LOCAL lock_timeout='10s'");
   // Serializes API, worker and administrative writes, including quota and stock.
   // A DB exclusion constraint independently enforces non-overlapping bookings.
   await client.query('SELECT id FROM kku_private.app_lock WHERE id=1 FOR UPDATE');
   const data=await load(client);
   const previous=new Map(tables.map(t=>[t,new Map(rows(data,t).map(r=>[key(t,r),JSON.stringify(r)]))]));
   const result=fn(data);
   if(result instanceof Promise)throw new Error('No async I/O inside a transaction callback');
   for(const table of [...tables].reverse()) {
    const present=new Set(rows(data,table).map(r=>key(table,r)));
    for(const old of previous.get(table)!.keys())if(!present.has(old))await client.query(`DELETE FROM kku_private.${table} WHERE key=$1`,[old]);
   }
   for(const table of tables)for(const row of rows(data,table)) {
    const rowKey=key(table,row),payload=JSON.stringify(row);
    if(previous.get(table)!.get(rowKey)===payload)continue;
    if(table==='bookings') {
     const b=row as Data['state']['bookings'][number];
     await client.query('INSERT INTO kku_private.bookings(key,payload,user_key,room_key,start_at,end_at,status) VALUES($1,$2::jsonb,$3,$4,$5,$6,$7) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,user_key=excluded.user_key,room_key=excluded.room_key,start_at=excluded.start_at,end_at=excluded.end_at,status=excluded.status',[rowKey,payload,String(b.userId),String(b.roomId),b.start,b.end,b.status]);
    }else await client.query(`INSERT INTO kku_private.${table}(key,payload) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload`,[rowKey,payload]);
   }
   await client.query('COMMIT');return result;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async close(){await this.pool.end();}
}
