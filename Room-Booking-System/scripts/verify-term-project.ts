// Isolated integration verification. Does not read .env or use live databases.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import type {Pool} from 'pg';
import {PostgresStore} from '../apps/backend/src/infrastructure/postgres-store';
import {createApplication} from '../apps/backend/src/main';
import {readConfig} from '../apps/backend/src/common/config';
import {createSeed} from '../apps/web/src/lib/seed';
import {testSession} from '../tests/backend/session-fixture';
import {addDays,dateOf} from '../packages/core/src/domain';
const require=createRequire('C:/Users/kitti/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const db=await PGlite.create({extensions:{btree_gist}});
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE kku_server LOGIN; CREATE SCHEMA extensions;');
for(const name of ['202610080001_server_storage','202610090001_password_auth','20261009171230_audit_settings','20261011184944_sql_security_hardening','20261012050202_term_project_relational','20261012052406_term_project_booking_exclusion'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
const client={query:(sql:string,args?:unknown[])=>db.query(sql,args),release:()=>{}};
const store=new PostgresStore({databaseUrl:''},{connect:async()=>client,end:()=>db.close()} as unknown as Pool);
await db.exec('SET ROLE kku_server');
await store.transaction(d=>{const s=createSeed();d.state.users=s.users;d.state.rooms=s.rooms;d.state.buildings=s.buildings;d.state.equipment=s.equipment;d.state.assignments=s.assignments;d.state.rooms[0].hours={start:'22:00',end:'02:00',weekdays:[0,1,2,3,4,5,6],leadMinutes:0};});
const c=readConfig({});
const app=await createApplication(store,c);await app.listen(0,'127.0.0.1');c.origin=await app.getUrl();
const browser=await chromium.launch({headless:true});
await mkdir('docs/verification/term-project',{recursive:true});
try{
 const session=await testSession(store,c,3);
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport});
  const [name,value]=session.cookie.split('=');
  await context.addCookies([{name,value,url:c.origin}]);
  const page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',(error:Error)=>errors.push(error.message));
  // Force a focus refresh between server commit and the command response.
  // It must not discard the new report or equipment state in the UI.
  await page.route('**/api/commands',async(route:any)=>{
   const response=await route.fetch();
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await route.fulfill({response});
  });
  await page.goto(`${c.origin}/#/reports`);
  await page.getByRole('button',{name:'บันทึกรายงาน',exact:true}).waitFor();
  const before=(await store.read()).state.reports?.length??0;
  await page.getByRole('button',{name:'บันทึกรายงาน',exact:true}).click();
  try{await page.getByRole('cell',{name:`R-${before+1}`,exact:true}).waitFor({timeout:10000});}
  catch(error){console.log('UI DIAGNOSTIC',await page.locator('body').innerText());console.log('REPORT DIAGNOSTIC',(await store.read()).state.reports);await page.screenshot({path:'docs/verification/term-project/report-failure.png',fullPage:true});throw error;}
  const saved=await db.query<{n:number}>('SELECT count(*)::int n FROM kku_booking.report');assert.equal(saved.rows[0].n,before+1);
  await page.reload();await page.getByRole('cell',{name:`R-${before+1}`,exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'reports overflow');
  await page.screenshot({path:`docs/verification/term-project/reports-${viewport.width}.png`,fullPage:true});
  await page.goto(`${c.origin}/#/equipment`);
  const retire=page.getByRole('button',{name:'เลิกใช้งาน',exact:true}).first();await retire.waitFor();await retire.click();
  await page.getByRole('button',{name:'เปิดใช้งาน',exact:true}).first().waitFor();
  await page.reload();await page.getByRole('button',{name:'เปิดใช้งาน',exact:true}).first().waitFor();
  await page.getByRole('button',{name:'เปิดใช้งาน',exact:true}).first().click();
  await page.getByRole('button',{name:'เลิกใช้งาน',exact:true}).first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'equipment overflow');
  await page.screenshot({path:`docs/verification/term-project/equipment-${viewport.width}.png`,fullPage:true});
  const day=addDays(dateOf(new Date().toISOString()),viewport.width===1440?2:3);
  await page.goto(`${c.origin}/#/rooms`);
  await page.getByRole('textbox',{name:'ค้นหาชื่อห้องหรืออาคาร'}).waitFor();
  await page.getByLabel('วันที่ต้องการจอง',{exact:true}).fill(day);
  await page.getByLabel('เวลาเริ่ม',{exact:true}).fill('23:00');
  await page.getByLabel('เวลาสิ้นสุด',{exact:true}).fill('01:00');
  await page.getByRole('checkbox',{name:'สิ้นสุดในวันถัดไป (เฉพาะห้องที่เปิดข้ามคืน)',exact:true}).check();
  await page.getByRole('button',{name:'เลือกวันและเวลาจอง ห้องศึกษากลุ่ม มอดินแดง',exact:true}).click();
  await page.locator('textarea').first().fill('ตรวจการจองข้ามวันจากเบราว์เซอร์');
  await page.screenshot({path:`docs/verification/term-project/overnight-${viewport.width}.png`,fullPage:true});
  await page.getByRole('button',{name:'ส่งคำขอจอง',exact:true}).click();
  await page.getByText('ส่งคำขอจองแล้ว',{exact:true}).first().waitFor();
  const overnight=await db.query<{n:number}>("SELECT count(*)::int n FROM kku_booking.booking WHERE booking_date=$1::date AND end_time AT TIME ZONE 'Asia/Bangkok'=(($1::date+1)+time '01:00')",[day]);assert.equal(overnight.rows[0].n,1);
  assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS ${viewport.width}: real HTTP + PostgreSQL reports, equipment soft delete/restore, overnight booking, reload, forced focus race, no overflow or page errors`);
 }
}finally{await browser.close();await app.close();await store.close();}
