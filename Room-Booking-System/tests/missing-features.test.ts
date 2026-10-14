import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../apps/web/src/lib/seed';
import { executeCommand, stamp } from '../packages/core/src/domain';
import { searchSlotError } from '../packages/core/src/search';

test('search requires complete future interval and validates duration, date and holiday',()=>{
 const s=createSeed();
 assert.ok(searchSlotError(s,'2026-10-09','',''));
 assert.equal(searchSlotError(s,'2026-10-09','10:00','11:00'),'');
 for(const [date,start,end] of [['2026-10-09','11:00','10:00'],['2026-10-09','10:00','10:15'],['2026-10-09','10:00','15:00'],['2026-11-09','10:00','11:00'],['2026-02-30','10:00','11:00'],['2026-10-09','99:00','11:00']])assert.ok(searchSlotError(s,date,start,end));
 s.holidays.push('2026-10-09');assert.ok(searchSlotError(s,'2026-10-09','10:00','11:00'));
});

test('named floors preserve stable IDs, room links, permissions and duplicate validation',()=>{
 const original=createSeed(),b=original.buildings[0];
 let s=executeCommand(original,3,{type:'FLOOR_SAVE',buildingId:b.id,number:1,name:'โถงประชุม'});
 assert.equal(s.buildings[0].levels?.[0].name,'โถงประชุม');
 assert.deepEqual(s.rooms,original.rooms);
 const id=s.buildings[0].levels?.[0].id;
 s=executeCommand(s,3,{type:'FLOOR_SAVE',buildingId:b.id,number:1,name:'ชั้นต้อนรับ'});
 assert.equal(s.buildings[0].levels?.[0].id,id);
 s=executeCommand(s,3,{type:'FLOOR_SAVE',buildingId:b.id,number:b.floors+1,name:'พื้นที่ใหม่'});
 assert.equal(s.buildings[0].floors,b.floors+1);
 assert.throws(()=>executeCommand(s,1,{type:'FLOOR_SAVE',buildingId:b.id,number:1,name:'อื่น'}));
 assert.throws(()=>executeCommand(s,3,{type:'FLOOR_SAVE',buildingId:b.id,number:2,name:'ชั้นต้อนรับ'}));
});

const book=()=>executeCommand(createSeed(),1,{type:'BOOK',roomId:1,start:stamp('2026-10-09','10:00'),end:stamp('2026-10-09','11:00'),purpose:'ทดสอบ',attendees:2,participants:[],equipment:[{id:1,qty:1}]});
test('inspection closes maintenance only after affected bookings confirmation, releases stock and can reopen',()=>{
 const s=book(),room=s.rooms.find(r=>r.id===1)!;
 const inspection={type:'INSPECT' as const,roomId:1,condition:'ต้องซ่อมบำรุง',note:'ประตูชำรุด',items:room.inventory?.map(i=>({id:i.id,damaged:i.damaged}))};
 assert.throws(()=>executeCommand(s,2,inspection));
 assert.equal(s.bookings[0].status,'PENDING');
 let next=executeCommand(s,2,{...inspection,closeAffected:true});
 assert.equal(next.rooms.find(r=>r.id===1)?.status,'MAINTENANCE');
 assert.equal(next.bookings[0].status,'CANCELLED');
 assert.equal(next.equipment[0].remaining,createSeed().equipment[0].remaining);
 assert.ok(next.notices.some(n=>n.subject==='ห้องปิดชั่วคราว'&&n.userId===1));
 next=executeCommand(next,2,{...inspection,condition:'พร้อมใช้งาน'});
 assert.equal(next.rooms.find(r=>r.id===1)?.status,'AVAILABLE');
 const occupied=structuredClone(s);occupied.bookings[0].status='CHECKED_IN';
 assert.throws(()=>executeCommand(occupied,2,{...inspection,closeAffected:true}));
});

test('manual email protects registered recipients, ownership, status and rate limit',()=>{
 let s=book();const user=s.users.find(u=>u.id===1)!,id=s.bookings[0].id;
 const command={type:'SEND_NOTICE' as const,recipientEmail:user.email,notificationType:'BOOKING' as const,bookingId:id};
 assert.throws(()=>executeCommand(s,4,command));
 assert.throws(()=>executeCommand(s,3,{...command,recipientEmail:'stranger@example.com'}));
 assert.throws(()=>executeCommand(s,1,{...command,notificationType:'CANCELLATION'}));
 for(let i=0;i<3;i++)s=executeCommand(s,1,command);
 assert.equal(s.notices.filter(n=>n.subject.startsWith('ส่งซ้ำ:')).length,3);
 assert.throws(()=>executeCommand(s,1,command));
});
