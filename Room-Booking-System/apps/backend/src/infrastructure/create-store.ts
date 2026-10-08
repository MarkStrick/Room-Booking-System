import type { Config } from '../common/config';
import type { Store } from './store';
import { emptyData } from './store';
import { PostgresStore } from './postgres-store';
export async function createStore(c:Config):Promise<Store> {
 if(c.store==='postgres') {
  const store=new PostgresStore(c);
  try {await store.read();return store;}catch(e){await store.close();throw e;}
 }
 // SQLite and sample accounts exist only for local integration verification.
 const {SqliteStore}=await import('./sqlite-store');
 const data=emptyData();
 if(c.devLogin) {
  const {createSeed}=await import('../../../web/src/lib/seed');
  const sample=createSeed();
  data.state={...data.state,users:sample.users,buildings:sample.buildings,rooms:sample.rooms,equipment:sample.equipment,assignments:sample.assignments};
 }
 return new SqliteStore(c.dbFile,data);
}
