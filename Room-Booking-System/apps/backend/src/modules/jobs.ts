import { randomUUID } from 'node:crypto';
import type { Data } from '../infrastructure/store';
import { ms } from '../../../../packages/core/src/domain';
const nextId=(rows:{id:number}[])=>Math.max(0,...rows.map(r=>r.id))+1;
export function runTimers(data:Data,now:string) {
 const s=data.state;
 for(const b of s.bookings) {
  if(b.status==='APPROVED'&&(ms(now)>ms(b.start)+1800000||ms(now)>=ms(b.end))) {
   b.status='NO_SHOW';
   if(!s.violations.some(v=>v.bookingId===b.id&&v.type==='NO_SHOW'))s.violations.push({id:nextId(s.violations),userId:b.userId,bookingId:b.id,type:'NO_SHOW',at:now});
   s.audit.unshift({id:nextId(s.audit),actorId:null,bookingId:b.id,at:now,text:`ไม่ได้เช็คอิน ${b.ref}`});
   const id=nextId(s.notices);
   s.notices.unshift({id,userId:b.userId,bookingId:b.id,subject:'พ้นกำหนดเช็คอิน',content:`${b.ref} บันทึกว่าไม่ได้เข้าใช้`,status:'QUEUED',createdAt:now,attempts:0});
   data.outbox.push({noticeId:id,status:'QUEUED',attempts:0,nextAt:now});
  }else if(b.status==='CHECKED_IN'&&ms(now)>=ms(b.end)) {
   b.status='COMPLETED';s.audit.unshift({id:nextId(s.audit),actorId:null,bookingId:b.id,at:now,text:`สิ้นสุดรอบ ${b.ref}`});
  }else continue;
  b.equipment.forEach(item=>{const e=s.equipment.find(e=>e.id===item.id);if(e)e.remaining=Math.min(e.total,e.remaining+item.qty);});
 }
 data.sessions=data.sessions.filter(s=>s.expiresAt>now);
 data.flows=data.flows.filter(f=>f.expiresAt>now);
 data.passwordTokens=data.passwordTokens.filter(t=>t.expiresAt>now);
 data.attempts=data.attempts.filter(a=>ms(a.at)>ms(now)-7*86400000);
 // No pending timeout or minimum lead time is added without a policy decision.
}
export function claimMail(data:Data,now:string) {
 const row=data.outbox.find(o=>(o.status==='QUEUED'&&o.nextAt<=now)||(o.status==='SENDING'&&(o.leaseUntil??'')<=now));
 if(!row)return null;
 const notice=data.state.notices.find(n=>n.id===row.noticeId);
 const user=notice&&data.state.users.find(u=>u.id===notice.userId);
 if(!notice||!user){row.status='FAILED';return null;}
 row.status='SENDING';row.leaseToken=randomUUID();row.leaseUntil=new Date(ms(now)+120000).toISOString();row.attempts++;
 return {notice:structuredClone(notice),to:user.email,token:row.leaseToken};
}
export function finishMail(data:Data,noticeId:number,token:string,now:string,success:boolean) {
 const row=data.outbox.find(o=>o.noticeId===noticeId);
 if(!row||row.status!=='SENDING'||row.leaseToken!==token)return;
 row.status=success?'SENT':row.attempts>=5?'FAILED':'QUEUED';
 row.nextAt=new Date(ms(now)+Math.min(3600000,30000*2**row.attempts)).toISOString();
 if(success)row.sentAt=now;else row.error='Mail gateway delivery failed';
 const notice=data.state.notices.find(n=>n.id===noticeId);
 if(notice){notice.status=success?'SENT':row.status==='FAILED'?'FAILED':'QUEUED';notice.attempts=row.attempts;}
 delete row.leaseToken;delete row.leaseUntil;
}
