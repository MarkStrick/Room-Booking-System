import {createRoot} from 'react-dom/client';
import {DemoContext} from './app/DemoProvider';
import {ExportApp} from './app/ExportApp';
import {ExportPasswordLogin} from './components/ExportPasswordLogin';
import {Brand} from './components/Brand';
import {createSeed} from './lib/seed';
import './styles.css'; import './student.css'; import './server.css';
import {snapshot} from './export-snapshot';
const root=createRoot(document.getElementById('root')!);
const query=new URLSearchParams(location.search),device=query.get('device')||'mobile';
const seed=createSeed();
const scenes:any[]=[];
const titles:any={rooms:'ค้นหาและจองห้อง',bookings:'การจองของฉัน',approvals:'พิจารณาคำขอ', 'manage-rooms':'จัดการห้อง',locations:'อาคารและชั้น',equipment:'อุปกรณ์ส่วนกลาง',penalties:'บทลงโทษ',reports:'รายงาน',notifications:'การแจ้งเตือน',help:'คำแนะนำและช่วยเหลือ',profile:'ข้อมูลส่วนตัว',access:'บัญชีและสิทธิ์'};
const roles:any={USER:1,STAFF:2,ADMIN:3};
for(const role of ['USER','STAFF','ADMIN']){
 const routes=role==='USER'?['rooms','bookings','notifications','help','profile']:role==='STAFF'?['rooms','bookings','approvals','manage-rooms','reports','notifications','help','profile']:Object.keys(titles);
 for(const route of routes)scenes.push({role,route,name:`${role} / ${titles[route]}`});
 scenes.push({role,route:'rooms',menu:true,name:`${role} / เมนูมือถือ`});
}
scenes.push({role:'USER',route:'rooms',filter:true,name:'USER / ตัวกรองเพิ่มเติม'});
for(const auth of ['login','register','forgot','verify-email','reset-password'])scenes.push({role:'USER',auth,name:`AUTH / ${auth}`});
scenes.push({role:'USER',route:'rooms',demoLogin:true,name:'AUTH / เลือกบัญชีสาธิต'});
const forms:any[]=[
 ['book','USER','rooms',{id:4,date:'2026-10-09',start:'10:00',end:'12:00',attendees:4},'ส่งคำขอจองห้อง'],
 ['detail','USER','bookings',{id:1},'รายละเอียดการจอง'],['cancel','USER','bookings',{id:2},'ยืนยันยกเลิกการจอง'],
 ['reject','ADMIN','approvals',{id:3},'ไม่อนุมัติคำขอ'],
 ['room','ADMIN','manage-rooms',{},'เพิ่มห้อง'],['room','ADMIN','manage-rooms',{id:1},'แก้ไขห้อง'],
 ['closure','ADMIN','manage-rooms',{id:1},'ปิดห้องชั่วคราว'],['inspect','STAFF','manage-rooms',{id:1},'บันทึกผลตรวจห้อง'],
 ['room-active','ADMIN','manage-rooms',{id:1,active:false},'เปลี่ยนการใช้งานห้อง'],['room-delete','ADMIN','manage-rooms',{id:1},'ยืนยันลบห้อง'],
 ['building','ADMIN','locations',{},'เพิ่มอาคาร'],['building','ADMIN','locations',{id:1},'แก้ไขอาคาร'],
 ['building-active','ADMIN','locations',{id:1,active:false},'เปลี่ยนการใช้งานอาคาร'],['building-delete','ADMIN','locations',{id:1},'ยืนยันลบอาคาร'],
 ['holiday','ADMIN','locations',{},'กำหนดวันหยุด'],['holiday-delete','ADMIN','locations',{date:'2026-10-13'},'ยืนยันลบวันหยุด'],
 ['equipment','ADMIN','equipment',{},'เพิ่มอุปกรณ์'],['equipment','ADMIN','equipment',{id:1},'แก้ไขอุปกรณ์'],
 ['penalty','ADMIN','penalties',{id:1},'พิจารณาบทลงโทษ'],['clock','ADMIN','rooms',{},'เวลาและงานสาธิต'],['reset','ADMIN','rooms',{},'เริ่มการสาธิตใหม่']
];
for(const [kind,role,route,extra,label]of forms)scenes.push({role,route,action:{kind,...extra},name:`FORM / ${label}`});
const wait=(n:number)=>new Promise(r=>setTimeout(r,n));
async function main(){
 await document.fonts.ready;
 for(let index=0;index<scenes.length;index++){
  const scene=scenes[index];
  (window as any).__exportAction=scene.action;(window as any).__exportMenu=scene.menu;(window as any).__exportLogin=scene.demoLogin;
  history.replaceState(null,'',`${location.pathname}?device=${device}#/`+(scene.route||scene.auth)+(scene.auth==='verify-email'||scene.auth==='reset-password'?'?token=design-preview':''));
  const user=seed.users.find(u=>u.id===roles[scene.role])!;
  const value:any={state:seed,user,switchUser:()=>{},run:async()=>{},reset:()=>{},toast:'',showToast:()=>{},persistent:true,mode:scene.action?.kind==='clock'||scene.action?.kind==='reset'||scene.demoLogin?'demo':'server',logout:async()=>{},manageAccess:async()=>{},hasPassword:true,setPassword:async()=>{}};
  root.render(<DemoContext.Provider key={index} value={value}>{scene.auth?<main className="session-page"><div className="session-content"><Brand/><h1>จองห้องสำหรับการเรียนรู้</h1><p>ค้นหาห้องว่าง ส่งคำขอจอง และติดตามผลได้ในที่เดียว</p><ExportPasswordLogin config={{passwordReady:true,registrationReady:true,googleReady:true} as any} route={scene.auth} onLogin={()=>{}}/><button className="btn ghost">ค้นหาห้องก่อนเข้าสู่ระบบ</button></div></main>:<ExportApp/>}</DemoContext.Provider>);
  await wait(index===0?1800:220);await document.fonts.ready;
  if(scene.filter){const details=document.querySelector('.student-extra-filters')||document.querySelector('.student-search details');if(details)details.setAttribute('open','');await wait(100);}
  window.scrollTo(0,0);
  const data=snapshot(document.getElementById('root')!,!!scene.action||!!scene.menu);
  const nodes=(n:any):number=>1+(n.children||[]).reduce((a:number,c:any)=>a+nodes(c),0);
  await fetch('http://127.0.0.1:5197',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device,index,name:scene.name,scene,width:innerWidth,viewport:innerHeight,height:data.h,nodes:nodes(data),tree:data})});
 }
 document.body.setAttribute('data-export-complete',String(scenes.length));
 document.title=`Export complete: ${device}, ${scenes.length} screens`;
 root.render(<div style={{padding:32}}>Export complete: {device}, {scenes.length} screens. Editable UI snapshots saved locally.</div>);
}
main().catch(e=>{document.body.setAttribute('data-export-error',String(e));console.error(e);});

