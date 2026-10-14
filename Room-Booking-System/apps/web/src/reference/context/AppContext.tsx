import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useDemo } from '../../app/DemoProvider';
import { searchSlotError } from '../../../../../packages/core/src/search';
import { availability, canManage, dateOf, stamp, time } from '../../lib/domain';
import type { Screen, Room, Booking, BookingStatus, ChatMessage, Notification, User } from '../types';

const routes: Record<string, Screen> = { rooms: 'search', bookings: 'history', approvals: 'admin', help: 'chatbot' };
const hashes: Partial<Record<Screen, string>> = { search: 'rooms', history: 'bookings', admin: 'approvals', chatbot: 'help' };
const subscribe = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
const route = () => location.hash.replace(/^#\/?/, '').split('?')[0];
const knownScreens = new Set<Screen>(['search','history','admin','chatbot','booking','checklist','notifications','profile','manage-rooms','locations','equipment','penalties','reports','access','operations','accessDenied']);
type BookingInput = Pick<Booking, 'roomId' | 'roomName' | 'building' | 'date' | 'startTime' | 'endTime' | 'purpose' | 'participants'> & { endDate?: string; equipment?: { id: number; qty: number }[]; participantEmails?: string[] };
interface ContextValue {
  screen: Screen; navigate: (screen: Screen) => void; goBack: () => void;
  currentUser: User; logout: () => void; refresh: () => Promise<void>;
  rooms: Room[]; bookings: Booking[]; today: string;
  selectedRoom: Room | null; setSelectedRoom: (room: Room | null) => void;
  searchSlot: { date: string; start: string; end: string; endDate?: string }; setSearchSlot: (slot: {date:string;start:string;end:string;endDate?:string}) => void;
  roomAvailable: (room: Room, date: string, start: string, end: string, endDate?: string) => boolean;
  addBooking: (data: BookingInput) => Promise<void>;
  cancelBooking: (id: string) => Promise<void>; checkIn: (id: string) => Promise<void>;
  approveBooking: (id: string) => Promise<void>; rejectBooking: (id: string, reason: string) => Promise<void>;
  selectedBookingForChecklist: Booking | null; setSelectedBookingForChecklist: (booking: Booking | null) => void;
  completeChecklist: (id: string, note: string, checked: Record<string, boolean>, damaged: Record<number, number>, condition: string, closeAffected?: boolean) => Promise<void>;
  chatMessages: ChatMessage[]; sendChatMessage: (text: string) => Promise<void>;
  notifications: Notification[]; markNotificationRead: (id: string) => Promise<void>; markAllNotificationsRead: () => Promise<void>; unreadNotificationCount: number;
  role: 'USER' | 'STAFF' | 'ADMIN';
  equipment: { id:number; name:string; remaining:number }[];
}
const AppContext = createContext<ContextValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const { state, user, run, logout, refresh, showToast } = useDemo();
  const hash = useSyncExternalStore(subscribe, route);
  const screen = user.id===0 ? 'search' : !hash ? (user.role==='USER'?'search':'admin') : routes[hash] ?? (knownScreens.has(hash as Screen) ? hash as Screen : 'accessDenied');
  const [history, setHistory] = useState<Screen[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedBookingForChecklist, setSelectedBookingForChecklist] = useState<Booking | null>(null);
  const [searchSlot, setSearchSlot] = useState<{date:string;start:string;end:string;endDate?:string}>({date:dateOf(state.now),start:'',end:''});
  const navigate = (next: Screen) => { if(user.id===0 && next!=='search'){if(next==='booking'&&selectedRoom)sessionStorage.setItem('kku-booking-intent',JSON.stringify({roomId:selectedRoom.id,slot:searchSlot}));location.hash='#/login';return;} if(next===screen)return; setHistory(prev=>[...prev,screen]); location.hash = '#/' + (hashes[next] ?? next); };
  const goBack = () => { const prev=history.at(-1) ?? (user.role==='USER'?'search':'admin'); setHistory(list=>list.slice(0,-1)); location.hash='#/'+(hashes[prev]??prev); };
  const rooms: Room[] = state.rooms.filter(r=>r.active!==false && state.buildings.some(b=>b.id===r.buildingId&&b.active!==false)).map(r=>({
    id:String(r.id), name:r.name, building:state.buildings.find(b=>b.id===r.buildingId)?.name??'', floor:state.buildings.find(b=>b.id===r.buildingId)?.levels?.find(f=>f.number===r.floor)?.name??`ชั้น ${r.floor}`, capacity:r.capacity,
    amenities:r.amenities, imageUrl:r.imageUrl??'', openTime:r.hours?.start??'', closeTime:r.hours?.end??'', inventory:r.inventory??[],
  }));
  const bookings: Booking[] = state.bookings.map(b=>{
    const room=state.rooms.find(r=>r.id===b.roomId),owner=state.users.find(u=>u.id===b.userId);
    return { ref:b.ref, archivedAt:b.archivedAt, equipment:b.equipment.map(i=>({name:state.equipment.find(e=>e.id===i.id)?.name??String(i.id),qty:i.qty})), participantEmails:b.participantEmails??[], id:String(b.id),roomId:String(b.roomId),roomName:room?.name??'',building:state.buildings.find(r=>r.id===room?.buildingId)?.name??'',
      userId:String(b.userId),userName:owner?.name??'',userEmail:owner?.email??'',date:dateOf(b.start),endDate:dateOf(b.end),startTime:time(b.start),endTime:time(b.end),
      purpose:b.purpose,participants:b.attendees,status:b.status.toLowerCase() as BookingStatus,rejectionReason:b.reason,createdAt:b.createdAt,
      canManage:canManage(state,user,b.roomId),
      checklistCompleted:state.inspections.some(i=>i.roomId===b.roomId&&i.at>=b.end),
    };
  });
  useEffect(()=>{
    if(!user.id)return;
    const raw=sessionStorage.getItem('kku-booking-intent');if(!raw)return;
    sessionStorage.removeItem('kku-booking-intent');
    try{const intent=JSON.parse(raw),room=rooms.find(r=>r.id===intent.roomId);if(room&&intent.slot&&typeof intent.slot.date==='string'&&typeof intent.slot.start==='string'&&typeof intent.slot.end==='string'){setSelectedRoom(room);setSearchSlot(intent.slot);location.hash='#/booking';}}catch{/* Ignore expired or malformed local intent. */}
  },[user.id]);
  const notifications: Notification[] = state.notices.filter(n=>user.role==='ADMIN'||n.userId===user.id).map(n=>{
    const b=bookings.find(b=>b.id===String(n.bookingId));
    const type = n.subject === 'คำขอไม่ได้รับการอนุมัติ' ? 'rejection'
      : n.subject === 'ยืนยันการยกเลิก' || (n.subject === 'ห้องปิดชั่วคราว' && n.content.includes('ถูกยกเลิก')) ? 'cancellation' : 'general';
    return {id:String(n.id),userId:n.userId,userEmail:state.users.find(u=>u.id===n.userId)?.email,type,bookingId:String(n.bookingId??''),
      roomName:b?.roomName??'',building:b?.building??'',requesterName:b?.userName??'',bookingDate:b?.date??'',startTime:b?.startTime??'',endTime:b?.endTime??'',
      participants:b?.participants??0,purpose:b?.purpose??'',read:n.userId!==user.id||!!n.readAt,createdAt:n.createdAt,subject:n.subject,content:n.content,status:n.status,attempts:n.attempts,sentAt:n.sentAt,deliveryError:n.deliveryError};
  });
  const chatMessages: ChatMessage[] = [{id:'welcome',sender:'bot',text:'สวัสดีครับ 👋 ผมคือผู้ช่วยจองห้องประชุม มข. ยินดีช่วยคุณค้นหาห้องและตอบคำถามเกี่ยวกับการจองครับ',timestamp:state.now},
    ...state.messages.filter(m=>m.userId===user.id).slice().sort((a,b)=>a.id-b.id).flatMap(m=>[
      {id:`q${m.id}`,sender:'user' as const,text:m.question,timestamp:m.at},{id:`a${m.id}`,sender:'bot' as const,text:m.answer,timestamp:m.at},
    ])];
  return <AppContext.Provider value={{
    screen,navigate,goBack,currentUser:{id:String(user.id),name:user.name,email:user.email,avatarUrl:'',role:user.role==='USER'?'user':'admin'},
    role:user.role,logout:()=>{void logout().catch(e=>showToast((e as Error).message));},refresh,rooms,bookings,today:dateOf(state.now),
    selectedRoom,setSelectedRoom,selectedBookingForChecklist,setSelectedBookingForChecklist,searchSlot,setSearchSlot,
    roomAvailable:(room,date,start,end,endDate=date)=>{const r=state.rooms.find(r=>r.id===Number(room.id));if(!r||r.status!=='AVAILABLE'||state.holidays.includes(date))return false;if(searchSlotError(state,date,start,end,endDate))return false;return availability(state,r,stamp(date,start),stamp(endDate,end)).kind==='available';},
    addBooking:async data=>{await run({type:'BOOK',roomId:Number(data.roomId),start:stamp(data.date,data.startTime),end:stamp(data.endDate??data.date,data.endTime),purpose:data.purpose,attendees:data.participants,participants:[],participantEmails:data.participantEmails??[],equipment:data.equipment??[]},'ส่งคำขอจองแล้ว');},
    cancelBooking:id=>run({type:'CANCEL',bookingId:Number(id)},'ยกเลิกการจองแล้ว'),checkIn:id=>run({type:'CHECKIN',bookingId:Number(id)},'เช็คอินแล้ว'),
    approveBooking:id=>run({type:'DECIDE',bookingId:Number(id),approve:true,reason:''},'อนุมัติการจองแล้ว'),
    rejectBooking:(id,reason)=>run({type:'DECIDE',bookingId:Number(id),approve:false,reason},'ปฏิเสธคำขอแล้ว'),
    completeChecklist:async(id,note,checked,damaged,condition,closeAffected)=>{const b=bookings.find(b=>b.id===id),room=state.rooms.find(r=>r.id===Number(b?.roomId));if(!b||!room)throw new Error('ไม่พบห้องที่ต้องตรวจ');await run({type:'INSPECT',roomId:room.id,closeAffected,condition:condition==='พร้อมใช้งาน'&&Object.values(damaged).some(v=>v>0)?'พบอุปกรณ์ชำรุด':condition,note:`รายการที่ตรวจแล้ว: ${Object.keys(checked).filter(id=>checked[id]).join(', ')}\n${note}`,items:room.inventory?.map(i=>({id:i.id,damaged:damaged[i.id]??i.damaged}))},'บันทึกผลตรวจแล้ว');},
    chatMessages,sendChatMessage:text=>run({type:'HELP',question:text},''),notifications,
    markNotificationRead:id=>run({type:'READ_NOTICE',noticeId:Number(id)},''),
    markAllNotificationsRead:async()=>{for(const n of notifications.filter(n=>!n.read))await run({type:'READ_NOTICE',noticeId:Number(n.id)},'');},
    unreadNotificationCount:notifications.filter(n=>!n.read).length,equipment:state.equipment.filter(e=>e.active!==false),
  }}>{children}</AppContext.Provider>;
}
export function useApp() { const value=useContext(AppContext);if(!value)throw new Error('AppProvider is required');return value; }
