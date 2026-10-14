import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Command, Room, AppState } from '../packages/contracts/src/index';
import { readConfig } from '../apps/backend/src/common/config';
import { createStore } from '../apps/backend/src/infrastructure/create-store';
import { applyCommand } from '../apps/backend/src/modules/booking-service';

type Sample={building:string;targetTotal:number;rooms:Omit<Room,'id'|'buildingId'|'status'|'reason'|'scene'>[]};
const catalog=JSON.parse(await readFile(new URL('../docs/data/sample-meeting-rooms.json',import.meta.url),'utf8')) as Sample;
const countVisible=(state:AppState)=>state.rooms.filter(r=>r.active!==false&&state.buildings.some(b=>b.id===r.buildingId&&b.active!==false)).length;
const store=await createStore(readConfig());
try {
  if(!process.argv.includes('--apply')) {
    const data=await store.read(),visible=countVisible(data.state);
    console.log(JSON.stringify({mode:'preview',currentRooms:visible,willAdd:Math.min(catalog.rooms.filter(r=>!data.state.rooms.some(x=>x.code===r.code)).length,Math.max(0,catalog.targetTotal-visible)),targetTotal:catalog.targetTotal,building:catalog.building,smallCapacity:'6–12',mediumCapacity:'16–40'}));
  }else {
    const result=await store.transaction(data=>{
      const admin=data.state.users.find(u=>u.email==='kittiphon.su@kkumail.com'&&u.active&&u.role==='ADMIN');
      if(!admin)throw new Error('The requested administrator must be active');
      const needed=Math.max(0,catalog.targetTotal-countVisible(data.state));
      const entries=catalog.rooms.filter(r=>!data.state.rooms.some(x=>x.code===r.code)).slice(0,needed);
      if(entries.length<needed)throw new Error('Not enough sample entries to reach the requested total');
      const now=new Date().toISOString();
      const execute=(command:Command)=>{const response=applyCommand(data,admin.id,command,randomUUID(),now);if(response instanceof Error)throw response;};
      if(!entries.length)return {added:0,total:countVisible(data.state)};
      let building=data.state.buildings.find(b=>b.name===catalog.building);
      if(!building){execute({type:'BUILDING_SAVE',name:catalog.building,floors:2});building=data.state.buildings.find(b=>b.name===catalog.building)!;execute({type:'FLOOR_SAVE',buildingId:building.id,number:1,name:'ชั้น 1 · ห้องขนาดเล็ก'});execute({type:'FLOOR_SAVE',buildingId:building.id,number:2,name:'ชั้น 2 · ห้องขนาดกลาง'});}
      if(building.active===false||building.floors<2)throw new Error('Existing sample zone needs review');
      for(const room of entries)execute({type:'ROOM_SAVE',room:{...room,buildingId:building.id,status:'AVAILABLE',reason:'',scene:0,active:true}});
      return {added:entries.length,total:countVisible(data.state)};
    });
    const data=await store.read();
    if(countVisible(data.state)<catalog.targetTotal)throw new Error('Room count verification failed');
    console.log(JSON.stringify({...result,verifiedTotal:countVisible(data.state),sampleRooms:data.state.rooms.filter(r=>r.code.startsWith('DEMO-')).length,realSourceRooms:data.state.rooms.filter(r=>r.code.startsWith('KKU-')).length}));
  }
}finally{await store.close();}
