import { useEffect, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { useDemo } from '../../app/DemoProvider';
import { request, type PublicConfig } from '../../lib/api';
import { Button } from './ui';
import { useAsyncAction } from '../useAsyncAction';

export function EmailComposer() {
  const {state,user,run,mode}=useDemo();
  const [ready,setReady]=useState<boolean|null>(null),[loadError,setLoadError]=useState('');
  const [open,setOpen]=useState(false),[recipient,setRecipient]=useState(user.email);
  const [kind,setKind]=useState<'BOOKING'|'CANCELLATION'|'REMINDER'|'GENERAL'>('BOOKING');
  const [bookingId,setBookingId]=useState(''),[message,setMessage]=useState('');
  const {busy,error,perform}=useAsyncAction();
  useEffect(()=>{let active=true;request<PublicConfig>('/config').then(c=>{if(active)setReady(Boolean(c.emailReady));}).catch(e=>{if(active)setLoadError((e as Error).message);});return()=>{active=false;};},[]);
  const recipients=state.users.filter(u=>u.active&&(user.role==='ADMIN'||u.id===user.id));
  const owner=recipients.find(u=>u.email===recipient);
  const bookings=state.bookings.filter(b=>b.userId===owner?.id && (kind!=='CANCELLATION'||b.status==='CANCELLED') && (kind!=='REMINDER'||b.status==='APPROVED'));
  return <section className="email-composer mb-4 bg-white border border-gray-200 rounded-xl p-4">
    <button className="flex items-center gap-2 text-sm font-semibold text-kku-red" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Mail size={18}/>ส่งอีเมลแจ้งเตือน</button>
    {open&&<form className="space-y-3 mt-4 text-sm text-gray-700" onSubmit={e=>{e.preventDefault();void perform(async()=>{await run({type:'SEND_NOTICE',recipientEmail:recipient,notificationType:kind,bookingId:kind==='GENERAL'?undefined:Number(bookingId),message:kind==='GENERAL'?message:undefined},'เพิ่มอีเมลลงคิวแล้ว');},()=>setOpen(false));}}>
      <p role="status">{mode==='demo'?'พื้นที่ทดสอบ: จำลองการเข้าคิวอีเมล':loadError||ready===null?'กำลังตรวจการเชื่อมต่ออีเมล…':ready?'พร้อมเข้าคิวส่งผ่านบริการอีเมล':'ยังไม่ได้เชื่อมบริการอีเมล กรุณาติดต่อผู้ดูแลระบบ'}{loadError&&` ${loadError}`}</p>
      <label className="block">อีเมลผู้รับ<select className="w-full border rounded-lg p-2 mt-1" aria-label="อีเมลผู้รับ" value={recipient} onChange={e=>{setRecipient(e.target.value);setBookingId('');}}>{recipients.map(u=><option key={u.id} value={u.email}>{u.email}</option>)}</select></label>
      <label className="block">ประเภทแจ้งเตือน<select className="w-full border rounded-lg p-2 mt-1" aria-label="ประเภทแจ้งเตือน" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setBookingId('');}}><option value="BOOKING">ยืนยันสถานะการจอง</option><option value="CANCELLATION">ยืนยันการยกเลิก</option><option value="REMINDER">เตือนการใช้ห้อง</option>{user.role==='ADMIN'&&<option value="GENERAL">ข้อความจากผู้ดูแล</option>}</select></label>
      {kind==='GENERAL'?<label className="block">ข้อความ<textarea required maxLength={500} aria-label="ข้อความอีเมล" className="w-full border rounded-lg p-2 mt-1" value={message} onChange={e=>setMessage(e.target.value)}/></label>:<label className="block">รายการจอง<select required className="w-full border rounded-lg p-2 mt-1" aria-label="รายการจองสำหรับอีเมล" value={bookingId} onChange={e=>setBookingId(e.target.value)}><option value="">เลือกรายการจอง</option>{bookings.map(b=><option key={b.id} value={b.id}>{b.ref} · {state.rooms.find(r=>r.id===b.roomId)?.name}</option>)}</select></label>}
      {error&&<p role="alert" className="text-red-600">{error}</p>}
      <Button type="submit" disabled={busy||(mode!=='demo'&&!ready)} className="w-full"><span className="flex gap-2 items-center justify-center"><Send size={16}/>{busy?'กำลังเข้าคิว…':'เข้าคิวส่งอีเมล'}</span></Button>
    </form>}
  </section>;
}
