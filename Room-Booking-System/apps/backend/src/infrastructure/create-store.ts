import type { Config } from '../common/config';
import type { Store } from './store';
import { emptyData } from './store';
import { PostgresStore } from './postgres-store';
export async function createStore(c:Config):Promise<Store> {
 if(c.store==='postgres') {
  const store=new PostgresStore(c);
  try {await store.read();return store;}catch(e){await store.close();throw e;}
 }
 // Fixtures are created explicitly by tests, never by an application startup flag.
 const {SqliteStore}=await import('./sqlite-store');
 const data=emptyData();
 return new SqliteStore(c.dbFile,data);
}
