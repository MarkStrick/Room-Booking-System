import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { AppState, Command } from '../../../../packages/contracts/src/index';
import { executeCommand, DomainError } from '../../../../packages/core/src/domain';
import { digest } from './session';
import { commandSchema } from '../common/validation';
import type { Data } from '../infrastructure/store';
import { projectState } from '../common/projection';
export function applyCommand(data:Data,userId:number,raw:unknown,key:unknown,now:string):AppState {
 const parsed=commandSchema.safeParse(raw);
 if(!parsed.success)throw new BadRequestException({code:'INVALID_INPUT',message:'กรุณาตรวจข้อมูลที่กรอก',fields:parsed.error.issues.map(i=>({path:i.path.join('.'),message:i.message}))});
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(key))throw new BadRequestException('ต้องมีรหัสคำขอสำหรับป้องกันการส่งซ้ำ');
 const command=parsed.data as Command;
 const user=data.state.users.find(u=>u.id===userId&&u.active);
 if(!user)throw new ForbiddenException('บัญชีไม่พร้อมใช้งาน');
 const hash=digest(JSON.stringify(command));
 const existing=data.attempts.find(a=>a.key===key&&a.actorId===userId);
 if(existing) {
  if(existing.hash!==hash)throw new ConflictException({code:'IDEMPOTENCY_CONFLICT',message:'รหัสคำขอเดิมมีข้อมูลต่างกัน กรุณาลองใหม่'});
  return projectState({...data.state,now},user);
 }
 if(command.type==='BOOK'&&command.participants.length)throw new BadRequestException('รุ่นนี้ยังไม่รองรับเพิ่มรายชื่อบุคคลอื่น กรุณาระบุจำนวนคน');
 // Workers own the clock and mail lifecycle. CLOCK/RUN_JOBS never enter this schema.
 const oldIds=new Set(data.state.notices.map(n=>n.id));
 try { data.state=executeCommand({...data.state,now},userId,command); }
 catch(e) {
  if(e instanceof DomainError) {
   if(e.code.startsWith('FORBIDDEN'))throw new ForbiddenException({code:e.code,message:e.message});
   throw new ConflictException({code:e.code,message:e.message});
  }
  throw e;
 }
 data.state.notices.filter(n=>!oldIds.has(n.id)).forEach(n=>data.outbox.push({noticeId:n.id,status:'QUEUED',attempts:0,nextAt:now}));
 if(command.type==='RETRY') {
  const delivery=data.outbox.find(o=>o.noticeId===command.noticeId);
  if(delivery){delivery.status='QUEUED';delivery.attempts=0;delivery.nextAt=now;delete delivery.leaseToken;delete delivery.leaseUntil;}
 }
 const bookingId=command.type==='BOOK'?data.state.bookings.find(b=>b.userId===userId&&b.createdAt===now&&b.roomId===command.roomId)?.id:undefined;
 data.attempts.push({key,actorId:userId,hash,bookingId,at:now});
 data.attempts=data.attempts.filter(a=>Date.parse(a.at)>Date.parse(now)-7*86400000);
 return projectState(data.state,data.state.users.find(u=>u.id===userId)!);
}
