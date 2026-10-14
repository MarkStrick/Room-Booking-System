// Read secrets from the operator environment; pass as a bind and never log them.
import {PostgresStore} from '../apps/backend/src/infrastructure/postgres-store';
import {readConfig} from '../apps/backend/src/common/config';
const c=readConfig();
if(c.cronSecret.length<32)throw new Error('Production CRON_SECRET is unavailable; scheduler not activated');
const store=new PostgresStore(c);
try{
 await store.pool.query('SELECT kku_private.configure_worker_secret($1)',[c.cronSecret]);
 console.log('Worker token installed in Vault; every-minute scheduler activated.');
}catch{throw new Error('Scheduler activation failed; do not print database errors or credentials');}
finally{await store.close();}
