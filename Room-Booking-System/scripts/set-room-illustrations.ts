import { readFile, access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { readConfig } from '../apps/backend/src/common/config';
import { createStore } from '../apps/backend/src/infrastructure/create-store';
import { applyCommand } from '../apps/backend/src/modules/booking-service';
import { isLocalRoomImage } from '../packages/core/src/media';

const catalog=JSON.parse(await readFile(new URL('../docs/data/kku-rooms-2026-10-12.json',import.meta.url),'utf8')) as {rooms:{code:string;imageUrl:string}[]};
for(const entry of catalog.rooms){
  if(!isLocalRoomImage(entry.imageUrl))throw new Error('Image path is not an allowed project asset');
  await access(new URL('../apps/web/public'+entry.imageUrl,import.meta.url));
}
const store=await createStore(readConfig());
try {
  await store.transaction(data=>{
    const admin=data.state.users.find(u=>u.email==='kittiphon.su@kkumail.com'&&u.active&&u.role==='ADMIN');
    if(!admin)throw new Error('The requested administrator is not active');
    for(const entry of catalog.rooms){
      const room=data.state.rooms.find(r=>r.code===entry.code);
      if(!room)throw new Error(`Missing room: ${entry.code}`);
      const result=applyCommand(data,admin.id,{type:'ROOM_SAVE',room:{...room,imageUrl:entry.imageUrl}},randomUUID(),new Date().toISOString());
      if(result instanceof Error)throw result;
    }
  });
  const verified=(await store.read()).state.rooms.filter(r=>catalog.rooms.some(e=>e.code===r.code));
  if(verified.some(r=>r.imageUrl!==catalog.rooms.find(e=>e.code===r.code)!.imageUrl))throw new Error('Image verification failed');
  console.log(JSON.stringify({updated:verified.map(r=>({code:r.code,imageUrl:r.imageUrl}))},null,2));
}finally{await store.close();}
