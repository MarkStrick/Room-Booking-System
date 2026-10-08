import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Data, Store } from './store';
import { emptyData } from './store';
export class SqliteStore implements Store {
 private db:DatabaseSync;
 constructor(path:string,initial:Data=emptyData()) {
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  this.db=new DatabaseSync(path);
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS kku_runtime(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)');
  this.db.prepare('INSERT OR IGNORE INTO kku_runtime(id,payload) VALUES(1,?)').run(JSON.stringify(initial));
 }
 async read():Promise<Data> {
  const row=this.db.prepare('SELECT payload FROM kku_runtime WHERE id=1').get()!;
  return {...emptyData(),...JSON.parse(row.payload as string)} as Data;
 }
 async transaction<T>(fn:(data:Data)=>T):Promise<T> {
  this.db.exec('BEGIN IMMEDIATE');
  try {
   const row=this.db.prepare('SELECT payload FROM kku_runtime WHERE id=1').get()!;
   const data:Data={...emptyData(),...JSON.parse(row.payload as string)};
   const result=fn(data);
   if(result instanceof Promise)throw new Error('Transaction callback must be synchronous; perform network I/O outside database locks');
   const encoded=JSON.stringify(data);
   if(encoded!==row.payload)this.db.prepare('UPDATE kku_runtime SET payload=? WHERE id=1').run(encoded);
   this.db.exec('COMMIT');
   return result;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 async close(){this.db.close();}
}
