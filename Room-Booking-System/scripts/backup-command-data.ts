// Local private snapshot, before additive schema migration. Never prints payloads.
import {mkdir,writeFile} from 'node:fs/promises';
import {PostgresStore} from '../apps/backend/src/infrastructure/postgres-store';
import {readConfig} from '../apps/backend/src/common/config';
const c=readConfig();
const store=new PostgresStore(c),client=await store.pool.connect();
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const names=await client.query<{name:string}>("SELECT tablename name FROM pg_tables WHERE schemaname='kku_private' ORDER BY tablename");
 const snapshot:Record<string,unknown>={};
 for(const {name} of names.rows){
  if(!/^[a-z_]+$/.test(name))throw new Error('Unexpected table');
  snapshot[name]=(await client.query(`SELECT * FROM kku_private."${name}"`)).rows;
 }
 await client.query('COMMIT');
 await mkdir('tmp/backups',{recursive:true});
 await writeFile('tmp/backups/pre-term-project.json',JSON.stringify({createdAt:new Date().toISOString(),schema:'kku_private',tables:snapshot}),{flag:'wx'});
 console.log(`Backup saved locally (${names.rows.length} tables); no payloads printed.`);
}catch{await client.query('ROLLBACK').catch(()=>undefined);throw new Error('Backup failed; do not migrate until resolved');}
finally{client.release();await store.close();}
