import { useState } from 'react';
import type { Role, User } from '../../../../packages/contracts/src/index';
import { useDemo } from '../app/DemoProvider';
export function UserAccess(){
 const {state}=useDemo();
 return <div className="user-access"><div className="student-page-heading"><h1>บัญชีและสิทธิ์</h1><p>กำหนดบทบาท ห้องที่เจ้าหน้าที่ดูแล และการเข้าใช้ระบบ</p></div>
 <div className="user-access-list">{state.users.map(user=><AccessRow key={`${user.id}-${user.role}-${user.active}-${state.assignments.find(a=>a.userId===user.id)?.roomIds.join(',')}`} target={user}/>)}</div></div>;
}
function AccessRow({target}:{target:User}){
 const {state,user,manageAccess}=useDemo();
 const [role,setRole]=useState<Role>(target.role),[active,setActive]=useState(target.active);
 const [rooms,setRooms]=useState(state.assignments.find(a=>a.userId===target.id)?.roomIds??[]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const self=target.id===user.id;
 async function save(){setBusy(true);setError('');try{await manageAccess(target.id,role,role==='STAFF'?rooms:[],active);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="access-row"><div><h2>{target.name}</h2><p>{target.email}</p></div>
 <div className="access-fields"><label>บทบาท<select value={role} disabled={self||busy} onChange={e=>setRole(e.target.value as Role)}><option value="USER">ผู้จอง</option><option value="STAFF">เจ้าหน้าที่</option><option value="ADMIN">ผู้ดูแลระบบ</option></select></label>
 <label className="checkbox-label"><input type="checkbox" checked={active} disabled={self||busy} onChange={e=>setActive(e.target.checked)}/>อนุญาตให้เข้าสู่ระบบ</label></div>
 {role==='STAFF'?<fieldset><legend>ห้องที่ได้รับมอบหมาย</legend><div className="access-room-options">{state.rooms.map(room=><label key={room.id} className="checkbox-label"><input type="checkbox" checked={rooms.includes(room.id)} disabled={busy} onChange={e=>setRooms(ids=>e.target.checked?[...ids,room.id]:ids.filter(id=>id!==room.id))}/>{room.code} · {room.name}</label>)}</div></fieldset>:null}
 {self?<p className="subtle">บัญชีที่กำลังใช้งาน เปลี่ยนสิทธิ์โดยผู้ดูแลอีกบัญชี</p>:<button className="btn" disabled={busy} onClick={()=>void save()}>{busy?'กำลังบันทึก…':'บันทึกสิทธิ์'}</button>}
 {error?<p className="form-error" role="alert">{error}</p>:null}</section>;
}
