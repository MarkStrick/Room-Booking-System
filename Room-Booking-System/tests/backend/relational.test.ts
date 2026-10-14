import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import type { Pool } from 'pg';
import { PostgresStore } from '../../apps/backend/src/infrastructure/postgres-store';
import { createSeed } from '../../apps/web/src/lib/seed';
import { applyCommand } from '../../apps/backend/src/modules/booking-service';
import { addDays,dateOf,stamp } from '../../packages/core/src/domain';
import { runTimers } from '../../apps/backend/src/modules/jobs';
import {reportData} from '../../packages/core/src/reporting';

async function fixture(){
 const db=await PGlite.create({extensions:{btree_gist}});
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE kku_server LOGIN; CREATE SCHEMA extensions;');
 for(const name of ['202610080001_server_storage','202610090001_password_auth','20261009171230_audit_settings','20261011184944_sql_security_hardening','20261012050202_term_project_relational','20261012052406_term_project_booking_exclusion'])await db.exec(await readFile(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
 const client={query:(sql:string,args?:unknown[])=>db.query(sql,args),release:()=>{}};
 const store=new PostgresStore({databaseUrl:''},{connect:async()=>client,end:()=>db.close()} as unknown as Pool);
 await db.exec('SET ROLE kku_server');
 await store.transaction(d=>{
  const s=createSeed();d.state.users=s.users;d.state.buildings=s.buildings;d.state.rooms=s.rooms;d.state.equipment=s.equipment;d.state.assignments=s.assignments;
  d.state.rooms[0].inventory=[{id:1,name:'ประจำห้อง',total:4,damaged:1}];
 });
 return {db,store};
}
test('all 18 PDF entities persist booking, approval, stock, participants, log and report in the same transaction',async()=>{
 const {db,store}=await fixture();
 try{
  const catalog=await db.query<{n:number}>("SELECT count(*)::int n FROM pg_tables WHERE schemaname='kku_booking'");assert.equal(catalog.rows[0].n,18);
  const now=new Date().toISOString(),day=addDays(dateOf(now),1),start=stamp(day,'10:00'),end=stamp(day,'11:00');
  await store.transaction(d=>applyCommand(d,1,{type:'BOOK',roomId:1,start,end,attendees:2,purpose:'Relational workflow',participants:[],participantEmails:[d.state.users[3].email],equipment:[{id:1,qty:2}]},'relational-book-01',now));
  let data=await store.read();const id=data.state.bookings[0].id;
  const loan=await db.query<{borrowed_qty:number}>("SELECT borrowed_qty FROM kku_booking.booking_equipment WHERE booking_booking_id=$1",[id]);assert.equal(loan.rows[0].borrowed_qty,2);
  const participant=await db.query<{users_user_id:number}>("SELECT users_user_id FROM kku_booking.booking_participant WHERE booking_booking_id=$1",[id]);assert.equal(Number(participant.rows[0].users_user_id),4);
  const installed=await db.query<{quantity:number;damaged_qty:number}>("SELECT quantity,damaged_qty FROM kku_booking.room_equipment WHERE room_room_id=1");assert.deepEqual(installed.rows[0],{quantity:4,damaged_qty:1});
  await store.transaction(d=>applyCommand(d,2,{type:'DECIDE',bookingId:id,approve:true,reason:''},'relational-approve-01',now));
  const approval=await db.query<{staff_staff_id:number;approved_at:string;booking_status:string}>("SELECT staff_staff_id,approved_at,booking_status FROM kku_booking.booking WHERE booking_id=$1",[id]);assert.equal(Number(approval.rows[0].staff_staff_id),2);assert.ok(approval.rows[0].approved_at);assert.equal(approval.rows[0].booking_status,'APPROVED');
  const notice=await db.query<{template_code:string;params_json:{bookingId:number}}>("SELECT template_code,params_json FROM kku_booking.notification WHERE template_code='BOOKING_APPROVED'");assert.equal(notice.rows[0].params_json.bookingId,id);
  await store.transaction(d=>applyCommand(d,1,{type:'CHECKIN',bookingId:id},'relational-checkin-01',start));
  await store.transaction(d=>applyCommand(d,2,{type:'EQUIPMENT_HANDOVER',bookingId:id,equipmentId:1,qty:2,action:'ISSUE'},'relational-issue-01',start));
  await store.transaction(d=>runTimers(d,end));
  await store.transaction(d=>applyCommand(d,2,{type:'EQUIPMENT_HANDOVER',bookingId:id,equipmentId:1,qty:2,action:'RETURN'},'relational-return-01',end));
  await store.transaction(d=>applyCommand(d,3,{type:'REPORT_SAVE',from:day,to:day},'relational-report-01',end));
  const reports=await db.query<{total_bookings:number;total_hours:string}>("SELECT total_bookings,total_hours FROM kku_booking.report");assert.equal(reports.rows[0].total_bookings,1);assert.equal(Number(reports.rows[0].total_hours),1);
  const before=await store.read();assert.equal(before.state.reports?.length,1);
  await assert.rejects(db.query("UPDATE kku_private.reports SET payload=jsonb_set(payload,'{totalBookings}','999')"),e=>(e as {code:string}).code==='23514');
  assert.deepEqual((await store.read()).state.reports,before.state.reports);
  const stock=await db.query<{remaining_qty:number}>("SELECT remaining_qty FROM kku_booking.equipment WHERE equipment_id='loan:1'");assert.equal(stock.rows[0].remaining_qty,before.state.equipment[0].total);
  await store.transaction(d=>applyCommand(d,3,{type:'EQUIPMENT_ACTIVE',equipmentId:1,active:false},'relational-retire-01',end));
  const retired=await db.query<{is_deleted:boolean;deleted_at:string}>("SELECT is_deleted,deleted_at FROM kku_booking.equipment WHERE equipment_id='loan:1'");assert.equal(retired.rows[0].is_deleted,true);assert.ok(retired.rows[0].deleted_at);
 }finally{await store.close();}
});
test('invalid relational children roll back source payloads, stock and outbox; browsers and runtime cannot mutate normalized tables',async()=>{
 const {db,store}=await fixture();
 try{
  const now=new Date().toISOString(),day=addDays(dateOf(now),1);
  await store.transaction(d=>applyCommand(d,1,{type:'BOOK',roomId:1,start:stamp(day,'10:00'),end:stamp(day,'11:00'),attendees:1,purpose:'Rollback test',participants:[],equipment:[{id:1,qty:1}]},'relational-rollback-01',now));
  const before=await store.read();
  await assert.rejects(store.transaction(d=>{
   d.state.equipment[0].remaining--;
   d.state.bookings[0].equipment.push({id:999,qty:1});
   d.outbox.push({noticeId:999,status:'QUEUED',attempts:0,nextAt:now});
  }),e=>(e as {code:string}).code==='23503');
  let after=await store.read();after.state.now=before.state.now;assert.deepEqual(after,before);
  await assert.rejects(store.transaction(d=>{d.state.rooms[0].inventory![0].damaged=99;}));
  after=await store.read();after.state.now=before.state.now;assert.deepEqual(after,before);
  await assert.rejects(db.exec('DELETE FROM kku_booking.booking'),e=>(e as {code:string}).code==='42501');
  await assert.rejects(db.query('SELECT kku_booking.sync_from_commands()'),e=>(e as {code:string}).code==='42501');
  for(const role of ['anon','authenticated']){
   await db.exec(`SET ROLE ${role}`);
   await assert.rejects(db.query('SELECT * FROM kku_booking.users'),e=>(e as {code:string}).code==='42501');
  }
 }finally{await store.close();}
});
test('overnight bookings preserve both dates, prevent overlap/holidays and clip reports to calendar days',async()=>{
 const {db,store}=await fixture();
 try{
  const now=new Date().toISOString(),day=addDays(dateOf(now),2),next=addDays(day,1);
  await store.transaction(d=>{d.state.rooms[0].hours={start:'22:00',end:'02:00',weekdays:[0,1,2,3,4,5,6],leadMinutes:0};});
  const command={type:'BOOK',roomId:1,start:stamp(day,'23:00'),end:stamp(next,'01:00'),attendees:1,purpose:'Overnight',participants:[],equipment:[]};
  await store.transaction(d=>applyCommand(d,1,command,'overnight-booking-01',now));
  const id=(await store.read()).state.bookings[0].id;
  await assert.rejects(store.transaction(d=>applyCommand(d,3,{type:'HOLIDAY_SAVE',date:next},'overnight-holiday-add-01',now)));
  await assert.rejects(store.transaction(d=>applyCommand(d,1,{...command,start:stamp(next,'00:00'),end:stamp(next,'01:30')},'overnight-conflict-01',now)));
  await store.transaction(d=>applyCommand(d,2,{type:'DECIDE',bookingId:id,approve:true,reason:''},'overnight-approve-01',now));
  await store.transaction(d=>applyCommand(d,1,{type:'CHECKIN',bookingId:id},'overnight-checkin-01',command.start));
  await store.transaction(d=>runTimers(d,command.end));
  const data=await store.read();data.state.now=command.end;
  assert.equal(reportData(data.state,[data.state.rooms[0]],day,day).hours,1);
  assert.equal(reportData(data.state,[data.state.rooms[0]],next,next).hours,1);
  const normalized=await db.query<{start_day:string;end_day:string}>("SELECT to_char(start_time AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD') start_day,to_char(end_time AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD') end_day FROM kku_booking.booking");assert.deepEqual(normalized.rows[0],{start_day:day,end_day:next});
  await store.transaction(d=>{d.state.holidays.push(next);});
  await assert.rejects(store.transaction(d=>applyCommand(d,1,{...command,start:stamp(day,'23:30'),end:stamp(next,'01:30')},'overnight-holiday-01',now)));
 }finally{await store.close();}
});
