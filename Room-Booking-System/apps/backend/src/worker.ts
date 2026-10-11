import { setTimeout as delay } from 'node:timers/promises';
import { readConfig } from './common/config';
import { createStore } from './infrastructure/create-store';
import { runJobCycle } from './modules/job-runner';
const c=readConfig(),store=await createStore(c);
let stopping=false;
const controller=new AbortController();
const stop=()=>{stopping=true;controller.abort();};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
while(!stopping) {
 try {
  await runJobCycle(store,c);
 }catch{console.error(JSON.stringify({event:'worker_cycle_failed'}));}
 await delay(30000,undefined,{signal:controller.signal}).catch(()=>{});
}
await store.close();
