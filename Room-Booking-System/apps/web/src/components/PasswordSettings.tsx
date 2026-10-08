import { useState,type FormEvent } from 'react';
import { useDemo } from '../app/DemoProvider';
export function PasswordSettings() {
 const {hasPassword,setPassword:save}=useDemo();
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function submit(event:FormEvent){event.preventDefault();if(busy)return;setError('');setMessage('');if(next!==confirmation){setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');return;}setBusy(true);try{await save(next,hasPassword?current:undefined);setCurrent('');setNext('');setConfirmation('');setMessage('บันทึกรหัสผ่านแล้ว อุปกรณ์อื่นจะต้องเข้าสู่ระบบใหม่');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel spaced password-settings"><h2>{hasPassword?'เปลี่ยนรหัสผ่าน':'ตั้งรหัสผ่านสำหรับบัญชีนี้'}</h2><p>เข้าสู่ระบบด้วยอีเมลและรหัสผ่านได้ด้วย รหัสผ่านใหม่ควรยาวอย่างน้อย 12 ตัวอักษร</p><form onSubmit={e=>void submit(e)}><fieldset disabled={busy}>
  {hasPassword?<label htmlFor="profile-current-password">รหัสผ่านปัจจุบัน<input id="profile-current-password" type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required maxLength={128}/></label>:null}
  <label htmlFor="profile-new-password">รหัสผ่านใหม่<input id="profile-new-password" type="password" autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)} required minLength={12} maxLength={128}/></label>
  <label htmlFor="profile-confirm-password">ยืนยันรหัสผ่านใหม่<input id="profile-confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required minLength={12} maxLength={128}/></label>
  {error?<p role="alert" className="session-error">{error}</p>:null}{message?<p role="status" className="password-message">{message}</p>:null}
  <button className="btn" type="submit" disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกรหัสผ่าน'}</button>
 </fieldset></form></section>;
}
