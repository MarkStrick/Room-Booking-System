import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { readConfig } from '../apps/backend/src/common/config';
import { createStore } from '../apps/backend/src/infrastructure/create-store';
import { applyCommand } from '../apps/backend/src/modules/booking-service';
import type { Command } from '../packages/contracts/src/index';

type Entry={code:string;name:string;building:string;floor:number;capacity:number;type:string;amenities:string[];source:string;imageUrl?:string};
const catalog=JSON.parse(await readFile(new URL('../docs/data/kku-rooms-2026-10-12.json',import.meta.url),'utf8')) as {rooms:Entry[]};
const store=await createStore(readConfig());
try {
  const apply=process.argv.includes('--apply');
  if(!apply) {
    const data=await store.read();
    console.log(JSON.stringify({mode:'preview',rooms:catalog.rooms.map(r=>({code:r.code,name:r.name,building:r.building,floor:r.floor,capacity:r.capacity,alreadyExists:data.state.rooms.some(x=>x.code===r.code),source:r.source}))},null,2));
  }else {
    const result=await store.transaction(data=>{
      const admin=data.state.users.find(u=>u.email==='kittiphon.su@kkumail.com'&&u.active&&u.role==='ADMIN');
      if(!admin)throw new Error('The requested administrator must be active before importing');
      const now=new Date().toISOString(),added:string[]=[],skipped:string[]=[];
      const execute=(command:Command)=>{const response=applyCommand(data,admin.id,command,randomUUID(),now);if(response instanceof Error)throw response;};
      for(const entry of catalog.rooms) {
        const existing=data.state.rooms.find(r=>r.code===entry.code);
        if(existing){skipped.push(entry.code);continue;}
        let building=data.state.buildings.find(b=>b.name===entry.building);
        const requiredFloor=Math.max(...catalog.rooms.filter(r=>r.building===entry.building).map(r=>r.floor));
        if(!building){execute({type:'BUILDING_SAVE',name:entry.building,floors:requiredFloor});building=data.state.buildings.find(b=>b.name===entry.building)!;}
        if(building.active===false||building.floors<requiredFloor)throw new Error(`Existing location needs review: ${entry.building}`);
        execute({type:'ROOM_SAVE',room:{code:entry.code,name:entry.name,buildingId:building.id,floor:entry.floor,capacity:entry.capacity,type:entry.type,amenities:entry.amenities,status:'AVAILABLE',reason:'',scene:0,active:true,imageUrl:entry.imageUrl??'',inventory:[]}});
        added.push(entry.code);
      }
      return {added,skipped};
    });
    const verified=(await store.read()).state.rooms.filter(r=>catalog.rooms.some(e=>e.code===r.code));
    if(verified.length!==catalog.rooms.length)throw new Error('Import verification failed');
    console.log(JSON.stringify({...result,verified:verified.map(r=>({id:r.id,code:r.code,name:r.name,floor:r.floor,capacity:r.capacity}))},null,2));
  }
}finally{await store.close();}
