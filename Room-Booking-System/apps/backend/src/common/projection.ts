import type { AppState, User } from '../../../../packages/contracts/src/index';
import { activeStatuses, canManage } from '../../../../packages/core/src/domain';
export function projectState(state:AppState,user:User):AppState {
 const authorized = state.bookings.filter(b=>b.userId===user.id || canManage(state,user,b.roomId));
 const bookingIds = new Set(authorized.map(b=>b.id));
 const users = new Set([user.id,...authorized.flatMap(b=>[b.userId,...b.participants])]);
 return {...state,
  users:state.users.filter(u=>user.role==='ADMIN'||users.has(u.id)).map(u=>u.id===user.id||user.role==='ADMIN'?u:{...u,email:'',phone:'',affiliation:''}),
  bookings:state.bookings.filter(b=>bookingIds.has(b.id)||activeStatuses.includes(b.status)).map(b=>bookingIds.has(b.id)?b:{id:b.id,ref:'',userId:0,roomId:b.roomId,start:b.start,end:b.end,status:b.status,purpose:'',attendees:0,participants:[],equipment:[],createdAt:''}),
  notices:state.notices.filter(n=>user.role==='ADMIN'||n.userId===user.id),
  penalties:state.penalties.filter(p=>user.role==='ADMIN'||p.userId===user.id),
  violations:state.violations.filter(v=>user.role==='ADMIN'||v.userId===user.id),
  messages:state.messages.filter(m=>m.userId===user.id),
  inspections:state.inspections.filter(i=>canManage(state,user,i.roomId)),
  audit:state.audit.filter(a=>user.role==='ADMIN'||a.actorId===user.id||(a.bookingId!==undefined&&bookingIds.has(a.bookingId))),
  assignments:state.assignments.filter(a=>user.role==='ADMIN'||a.userId===user.id)
 };
}
