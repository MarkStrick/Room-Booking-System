import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../apps/web/src/lib/seed';
import { answerAssistant, emptyIntent, localAssistantIntent, ownedBookingAnswer } from '../packages/core/src/assistant';
import { stamp, statusLabels } from '../packages/core/src/domain';
import type { AssistantSearch } from '../packages/contracts/src/assistant';

function fixture() {
  const s = createSeed();
  s.now = stamp('2026-10-14','09:00'); s.bookings = []; s.closures = []; s.holidays = [];
  s.rooms.forEach(r => { r.active = true; r.status = 'AVAILABLE'; r.hours = { start:'08:00',end:'18:00',weekdays:[0,1,2,3,4,5,6],leadMinutes:0 }; });
  return s;
}
test('today uses Bangkok date, asks for time, and retains search context on follow-up', () => {
  const s = fixture(); s.now = '2026-10-13T18:30:00Z';
  const first = answerAssistant(s,localAssistantIntent(s,{question:'วันนี้มีห้องไหนว่างบ้าง'}),'fallback');
  assert.equal(first.search?.date,'2026-10-14'); assert.equal(first.needsDetails,true); assert.deepEqual(first.rooms,[]);
  const second = answerAssistant(s,localAssistantIntent(s,{question:'14:00 ถึง 16:00 สำหรับ 10 คน',context:first.search}),'fallback');
  assert.equal(second.needsDetails,false); assert.equal(second.search?.capacity,10); assert.ok(second.total > 0);
  const third = localAssistantIntent(s,{question:'ยกเลิกการจองอย่างไร?',context:second.search});
  assert.equal(third.kind,'faq');
});
test('room search checks all active reservations, boundaries, capacity, closures, holidays and hours', () => {
  const s = fixture();
  const filter: AssistantSearch = { date:'2026-10-15',start:'10:00',end:'12:00',endDate:'2026-10-15',capacity:1,amenities:[],building:'',roomQuery:'' };
  const intent = localAssistantIntent(s,{question:'ค้นหา',filters:filter});
  s.rooms = [s.rooms[0]];
  const room = s.rooms[0];
  const result = () => answerAssistant(s,intent,'fallback');
  assert.equal(result().total,1);
  s.bookings.push({id:99,ref:'private-reference',userId:4,roomId:room.id,start:stamp(filter.date,'09:00'),end:stamp(filter.date,'10:00'),status:'PENDING',purpose:'private-purpose',attendees:1,participants:[],equipment:[],createdAt:s.now});
  assert.equal(result().total,1,'adjacent reservation does not overlap');
  s.bookings[0].end = stamp(filter.date,'10:01'); assert.equal(result().total,0);
  s.bookings[0].status = 'CANCELLED'; assert.equal(result().total,1);
  s.closures.push({id:1,roomId:room.id,start:stamp(filter.date,'11:00'),end:stamp(filter.date,'13:00'),reason:'private-closure-note'}); assert.equal(result().total,0);
  s.closures=[]; s.holidays=[filter.date]; assert.equal(result().total,0);
  s.holidays=[]; room.hours!.weekdays=[]; assert.equal(result().total,0);
  room.hours!.weekdays=[0,1,2,3,4,5,6]; room.hours!.leadMinutes=3000; assert.equal(result().total,0);
  room.hours!.leadMinutes=0; room.active=false; assert.equal(result().total,0);
  room.active=true; delete room.hours; assert.equal(result().total,1,'legacy rooms use the same availability rules as booking');
  s.buildings.find(b=>b.id===room.buildingId)!.active=false; assert.equal(result().total,0);
});
test('amenities include working fixed inventory and Thai projector aliases; unavailable equipment is never ignored', () => {
  const s=fixture(); s.rooms=[s.rooms[0]]; const room=s.rooms[0]; room.amenities=[];
  room.inventory=[{id:77,name:'โปรเจคเตอร์',total:1,damaged:0}];
  const intent=localAssistantIntent(s,{question:'พรุ่งนี้ 10:00–12:00 มีห้องที่มีโปรเจกเตอร์ไหม'});
  assert.ok(intent.amenities.includes('โปรเจกเตอร์')); assert.equal(answerAssistant(s,intent,'fallback').total,1);
  room.inventory[0].damaged=1; assert.equal(answerAssistant(s,intent,'fallback').total,0);
  intent.capacity=room.capacity+1; assert.equal(answerAssistant(s,intent,'fallback').total,0);
});
test('invalid dates, old slots, long durations, missing dates and out-of-scope never invent rooms', () => {
  const s=fixture();
  for (const q of ['ห้องว่างวันที่ 2026-02-30','วันนี้ 08:00–10:00 มีห้องไหม','พรุ่งนี้ 10:00–17:00 มีห้องไหม','ขอห้องสำหรับ 10 คน']) {
    const result=answerAssistant(s,localAssistantIntent(s,{question:q}),'fallback');
    assert.equal(result.needsDetails,true,q); assert.deepEqual(result.rooms,[]);
  }
  const answer=answerAssistant(s,emptyIntent('out-of-scope'),'gemini'); assert.equal(answer.total,0); assert.match(answer.text,/ระบบจองห้อง/);
});
test('overnight rooms and partial criteria can be searched without assuming every room has the same hours', () => {
  const s=fixture(); s.rooms=[s.rooms[0]]; s.rooms[0].hours={start:'22:00',end:'02:00',weekdays:[0,1,2,3,4,5,6],leadMinutes:0};
  const intent=localAssistantIntent(s,{question:'พรุ่งนี้ 23:00–01:00 ข้ามคืนมีห้องว่างไหม'});
  const result=answerAssistant(s,intent,'fallback'); assert.equal(result.total,1); assert.equal(result.search?.endDate,'2026-10-16');
});
test('booking references only reveal status to the owner and bypass the model', () => {
  const s=createSeed(),b=s.bookings[0];
  assert.ok(ownedBookingAnswer(s,b.userId,b.ref)!.text.includes(statusLabels[b.status]));
  assert.equal(ownedBookingAnswer(s,b.userId===1?4:1,b.ref)!.text,'ไม่พบรายการจองนี้ในบัญชีของคุณ');
});
