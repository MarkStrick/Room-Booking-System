import { useEffect,useState,type FormEvent } from 'react';
import { Eye,EyeOff,LogIn } from 'lucide-react';
import { request,type PublicConfig,type Session } from '../lib/api';
type View='login'|'register'|'forgot'|'verify-email'|'reset-password';
export function PasswordLogin({config,onLogin,route}:{config:PublicConfig;onLogin:(session:Session)=>void;route:string}) {
 const initial:View=route==='verify-email'||route==='reset-password'?route:'login';
 const [view,setView]=useState<View>(initial),[email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const value=new URLSearchParams(location.hash.split('?')[1]??'').get('token')??'';
 useEffect(()=>{if(route==='verify-email'||route==='reset-password')setView(route);},[route]);
 function change(next:View){if(busy)return;setView(next);setError('');setMessage('');setPassword('');setConfirmation('');setVisible(false);if(initial!=='login')location.hash='#/rooms';}
 async function submit(event:FormEvent) {
  event.preventDefault();if(busy)return;setError('');setMessage('');
  if((view==='register'||view==='reset-password')&&password!==confirmation){setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');return;}
  setBusy(true);
  try {
   if(view==='login'){const session=await request<Session>('/auth/password/login',{method:'POST',body:JSON.stringify({email,password})});setPassword('');location.hash='#/rooms';onLogin(session);}
   else if(view==='register'){const result=await request<{message:string}>('/auth/password/register',{method:'POST',body:JSON.stringify({email,name,password})});setMessage(result.message);setPassword('');setConfirmation('');}
   else if(view==='forgot'){const result=await request<{message:string}>('/auth/password/request-reset',{method:'POST',body:JSON.stringify({email})});setMessage(result.message);}
   else {const result=await request<{message:string}>(view==='verify-email'?'/auth/password/confirm':'/auth/password/reset',{method:'POST',body:JSON.stringify(view==='verify-email'?{token:value}:{token:value,password})});setView('login');setPassword('');setConfirmation('');setMessage(result.message);location.hash='#/rooms';}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const title={login:'เข้าสู่ระบบ',register:'สร้างบัญชีของคุณ',forgot:'ลืมรหัสผ่าน', 'verify-email':'ยืนยันอีเมล', 'reset-password':'ตั้งรหัสผ่านใหม่'}[view];
 const ready=view==='login'?config.passwordReady: view==='register'||view==='forgot'?config.registrationReady:true;
 return <section className="password-login" aria-label={title}>
  <h2>{title}</h2>
  {view==='register'?<p>ใช้อีเมลของคุณ และยืนยันอีเมลก่อนเริ่มจองห้อง</p>:null}
  {view==='forgot'?<p>กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้</p>:null}
  {view==='verify-email'?<p>กดยืนยันเพื่อเปิดใช้งานบัญชีของคุณ</p>:null}
  <form onSubmit={event=>void submit(event)}>
   <fieldset disabled={busy}>
    {view==='register'?<label htmlFor="auth-name">ชื่อที่แสดง<input id="auth-name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required maxLength={120}/></label>:null}
    {view==='login'||view==='register'||view==='forgot'?<label htmlFor="auth-email">อีเมล<input id="auth-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/></label>:null}
    {view==='login'||view==='register'||view==='reset-password'?<div className="password-field"><label htmlFor="auth-password">{view==='login'?'รหัสผ่าน':'รหัสผ่านใหม่'}</label><span className="password-input"><input id="auth-password" type={visible?'text':'password'} autoComplete={view==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={view==='login'?1:12} maxLength={128} aria-describedby={view==='login'?undefined:'password-length'}/><button type="button" aria-label={visible?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></span></div>:null}
    {view==='register'||view==='reset-password'?<><p id="password-length" className="password-help">อย่างน้อย 12 ตัวอักษร แนะนำให้ใช้วลีที่จำได้และเดายาก</p><label htmlFor="auth-confirm">ยืนยันรหัสผ่าน<input id="auth-confirm" type={visible?'text':'password'} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required minLength={12} maxLength={128}/></label></>:null}
    {error?<p className="session-error" role="alert">{error}</p>:null}
    {message?<p className="password-message" role="status">{message}</p>:null}
    {!ready?<p className="password-help">{view==='login'?'ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาติดต่อผู้ดูแล':'ระบบส่งอีเมลยังไม่พร้อม กรุณาติดต่อผู้ดูแล'}</p>:null}
    <button type="submit" className="btn password-submit" disabled={!ready||busy||(view==='verify-email'||view==='reset-password')&&!value}>{busy?'กำลังดำเนินการ…':view==='login'?'เข้าสู่ระบบ':view==='register'?'สมัครและส่งอีเมลยืนยัน':view==='forgot'?'ส่งลิงก์ตั้งรหัสผ่าน':view==='verify-email'?'ยืนยันอีเมล':'บันทึกรหัสผ่านใหม่'}</button>
   </fieldset>
  </form>
  <div className="password-links">{view==='login'?<><button disabled={busy} type="button" onClick={()=>change('forgot')}>ลืมรหัสผ่าน</button><button disabled={busy} type="button" onClick={()=>change('register')}>สร้างบัญชี</button></>:<button disabled={busy} type="button" onClick={()=>change('login')}>กลับไปเข้าสู่ระบบ</button>}</div>
  {view==='login'?<><div className="password-divider">หรือ</div><a className={`btn ghost session-google ${config.googleReady?'':'disabled'}`} href={config.googleReady?'/api/auth/google':undefined} aria-disabled={!config.googleReady}><LogIn size={19}/>เข้าสู่ระบบด้วย Google</a><p className="password-help">{config.googleReady?'ใช้บัญชี Google ได้ทุกอีเมล':'Google Login ยังไม่พร้อม กรุณาเข้าสู่ระบบด้วยรหัสผ่าน'}</p></>:null}
 </section>;
}
