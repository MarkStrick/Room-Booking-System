// Local browser verification only. This entrypoint never loads .env or cloud credentials.
import { createApplication } from '../apps/backend/src/main';
import { readConfig } from '../apps/backend/src/common/config';
import { SqliteStore } from '../apps/backend/src/infrastructure/sqlite-store';
import { emptyData } from '../apps/backend/src/infrastructure/store';
import { digest } from '../apps/backend/src/modules/session';
import { createSeed } from '../apps/web/src/lib/seed';
import { resolve } from 'node:path';

const data=emptyData();data.state={...createSeed(),now:new Date().toISOString()};
// Opt-in hours for assistant browser checks; this remains an in-memory, loopback fixture.
if(process.env.UI_FIXTURE_ASSISTANT==='1')data.state.rooms.forEach(room=>{room.hours={start:'08:00',end:'18:00',weekdays:[0,1,2,3,4,5,6],leadMinutes:0};});
data.state.settings={contactEmail:'support@example.com',contactPhone:'',faqs:[]};
// Known cookies exist only in this loopback-only, disposable browser fixture.
for(const userId of [1,2,3])data.sessions.push({userId,hash:digest(`kku-ui-fixture-user-${userId}`),csrf:`kku-ui-fixture-csrf-${userId}`,expiresAt:new Date(Date.now()+3600000).toISOString()});
process.env.WEB_DIST=resolve('apps/web/dist');
const fixturePort=process.env.UI_FIXTURE_PORT??'3180';
const c=readConfig({NODE_ENV:'development',APP_ORIGIN:`http://127.0.0.1:${fixturePort}`,PORT:fixturePort}),store=new SqliteStore(':memory:',data);
const app=await createApplication(store,c);await app.listen(c.port,c.host);
console.log(`Isolated UI fixture ready at ${c.origin}`);
const stop=async()=>{await app.close();await store.close();process.exit(0);};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
