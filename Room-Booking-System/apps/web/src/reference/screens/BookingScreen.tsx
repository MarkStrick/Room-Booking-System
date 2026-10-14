import { TimeSelect } from '../components/TimeSelect';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppHeader } from '../components/PhoneFrame';
import { Button } from '../components/ui';
import { Users, Calendar, Clock, MapPin, CheckCircle2, FileText, Image as ImageIcon } from 'lucide-react';
import { useAsyncAction } from '../useAsyncAction';
import { RoomImage } from '../components/RoomImage';
import { useDemo } from '../../app/DemoProvider';
import { searchSlotError } from '../../../../../packages/core/src/search';
import { addDays, availability, dateOf, stamp, time } from '../../lib/domain';

export function BookingScreen() {
  const { selectedRoom, addBooking, navigate, searchSlot, equipment, bookings, currentUser } = useApp();
  const { state } = useDemo();
  const [date, setDate] = useState(searchSlot.date || dateOf(state.now));
  const [startTime, setStartTime] = useState(searchSlot.start);
  const [endTime, setEndTime] = useState(searchSlot.end);
  const [endNextDay,setEndNextDay]=useState(!!searchSlot.endDate&&searchSlot.endDate!==searchSlot.date);
  const endDate=endNextDay?addDays(date,1):date;
  const room = state.rooms.find(r => String(r.id) === selectedRoom?.id);
  const slotError = searchSlotError(state,date,startTime,endTime,endDate);
  const available = room && !slotError ? availability(state,room,stamp(date,startTime),stamp(endDate,endTime)) : undefined;
  const timeIssue = slotError || (!room ? 'ไม่พบห้องที่เลือก' : available?.kind !== 'available' ? available?.reason || available?.label || 'กรุณาเลือกช่วงเวลาอื่น' : '');
  const reserved = state.bookings.filter(b => b.roomId === room?.id && ['PENDING','APPROVED','CHECKED_IN'].includes(b.status) && dateOf(b.start) <= endDate && dateOf(b.end) >= date).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const [participants, setParticipants] = useState(Math.min(10,selectedRoom?.capacity??10));
  const [purpose, setPurpose] = useState('');

  const [participantEmails,setParticipantEmails]=useState('');
  const [quantities,setQuantities]=useState<Record<number,number>>({});
  const equipmentError = (id: number, remaining: number) => {
    const qty = quantities[id] ?? 0;
    if (qty > remaining) return 'ยืมได้สูงสุด ' + remaining + ' ชิ้น กรุณาลดจำนวน';
    if (!Number.isInteger(qty) || qty < 0) return 'กรุณาระบุจำนวนเต็มตั้งแต่ 0 ถึง ' + remaining + ' ชิ้น';
    return '';
  };
  const hasEquipmentError = equipment.some(item => !!equipmentError(item.id, item.remaining));
  const [success, setSuccess] = useState(false);
  const {busy,error,perform}=useAsyncAction();
  useEffect(()=>{if(!selectedRoom)navigate('search');},[selectedRoom]);

  if (!selectedRoom) {
    return null;
  }

  const handleSubmit = () => perform(async () => {
    if(timeIssue)throw new Error(timeIssue);
    if(hasEquipmentError)throw new Error('กรุณาแก้ไขจำนวนอุปกรณ์ก่อนส่งคำขอจอง');
    if(!date || !startTime || !endTime || (!endNextDay&&endTime<=startTime))throw new Error('กรุณาเลือกวันที่และเวลาให้ถูกต้อง');
    if(!purpose.trim())throw new Error('กรุณาระบุวัตถุประสงค์ของการจอง');
    if(!Number.isInteger(participants)||participants<1||participants>selectedRoom.capacity)throw new Error(`จำนวนผู้เข้าร่วมต้องอยู่ระหว่าง 1–${selectedRoom.capacity} ท่าน`);
    await addBooking({
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      building: selectedRoom.building,
      date,
      startTime,
      endTime,
      endDate,
      purpose: purpose.trim(),
      participants,
      equipment:Object.entries(quantities).filter(([,qty])=>qty>0).map(([id,qty])=>({id:Number(id),qty})),
      participantEmails:participantEmails.split(/[\s,;]+/).filter(Boolean),
    });
  },()=>setSuccess(true));

  if (success) {
    return (
      <div className="flex flex-col h-full bg-white">
        <AppHeader showBack={false} />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <CheckCircle2 size={44} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">ส่งคำขอจองแล้ว</h2>
          <p className="text-sm font-semibold text-kku-red mb-3">เลขที่จอง {bookings.filter(b=>b.userId===currentUser.id&&b.roomId===selectedRoom.id&&b.date===date&&b.startTime===startTime).sort((a,b)=>Number(b.id)-Number(a.id))[0]?.ref}</p>
          <p className="text-sm text-gray-500 mb-1">คำขอของคุณถูกส่งไปยังผู้ดูแลแล้ว</p>
          <p className="text-sm text-gray-500 mb-8">ติดตามผลการพิจารณาได้ที่ประวัติการจอง</p>
          <Button onClick={() => navigate('history')} size="lg" className="w-full">
            ดูสถานะการจอง
          </Button>
          <button onClick={() => navigate('search')} className="mt-3 text-sm text-gray-500 font-semibold">
            กลับหน้าค้นหา
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <AppHeader title="จองห้องประชุม" />

      <div className="booking-content flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
        {/* Room summary card */}
        <div className="booking-room-summary bg-white rounded-2xl overflow-hidden border border-gray-100 mb-4">
          <RoomImage key={selectedRoom.imageUrl} src={selectedRoom.imageUrl} name={selectedRoom.name} className="w-full h-32 object-cover" />
          <div className="p-3">
            <h2 className="font-bold text-gray-900 text-base">{selectedRoom.name}</h2>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin size={12} /> {selectedRoom.building} · {selectedRoom.floor}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Users size={14} /> {selectedRoom.capacity} ท่าน</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {selectedRoom.openTime}–{selectedRoom.closeTime}</span>
            </div>
        <section className="booking-room-equipment mb-4 p-3" aria-labelledby="room-equipment-title">
          <h3 id="room-equipment-title" className="text-sm font-semibold text-gray-900">อุปกรณ์ภายในห้อง</h3>
          {selectedRoom.inventory.length ? <ul className="mt-2 space-y-2 text-sm text-gray-700">{selectedRoom.inventory.map(item=><li key={item.id} className="flex justify-between gap-3"><span>{item.name}</span><span>พร้อมใช้ {Math.max(0,item.total-item.damaged)} / {item.total} ชิ้น</span></li>)}</ul> : <p className="mt-2 text-sm text-gray-600">ยังไม่มีข้อมูลรายการอุปกรณ์ภายในห้อง</p>}
          {selectedRoom.amenities.length > 0 && <p className="mt-3 text-sm text-gray-600">สิ่งอำนวยความสะดวก: {selectedRoom.amenities.join(' · ')}</p>}
        </section>
          </div>
        </div>

        {/* Form */}
        <div className="booking-form-fields space-y-4">
          <p className="text-sm text-gray-600">เลือกหรือเปลี่ยนวันและเวลาจองได้ที่นี่ ระบบจะตรวจห้องว่างตามช่วงที่เลือก</p>
          {room?.hours && <p className="text-sm text-gray-600">เปิด {room.hours.start}–{room.hours.end} น. · {room.hours.weekdays.map(d=>['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'][d]).join(' ')}{room.hours.leadMinutes ? ` · จองล่วงหน้าอย่างน้อย ${room.hours.leadMinutes} นาที` : ''}</p>}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={16} className="text-kku-red" /> วันที่ต้องการจอง
            </label>
            <input
              type="date"
              aria-label="วันที่ต้องการจอง"
              value={date}
              min={dateOf(state.now)}
              max={addDays(dateOf(state.now),15)}
              disabled={busy}
              onChange={e=>setDate(e.target.value)}
              aria-describedby="booking-time-feedback"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kku-red transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Clock size={16} className="text-kku-red" /> เวลาเริ่ม
              </label>
              <TimeSelect
                aria-label="เวลาเริ่ม"
                value={startTime}
                disabled={busy}
                onChange={e=>setStartTime(e.target.value)}
                aria-describedby="booking-time-feedback"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kku-red transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Clock size={16} className="text-kku-red" /> เวลาสิ้นสุด
              </label>
              <TimeSelect
                aria-label="เวลาสิ้นสุด"
                value={endTime}
                disabled={busy}
                onChange={e=>setEndTime(e.target.value)}
                aria-describedby="booking-time-feedback"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kku-red transition-colors"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" disabled={busy} checked={endNextDay} onChange={e=>setEndNextDay(e.target.checked)}/> สิ้นสุดในวันถัดไป {endNextDay?`(${endDate})`:''}</label>
          <p id="booking-time-feedback" role="status" className={`text-sm ${timeIssue && startTime && endTime ? 'text-red-600' : 'text-gray-600'}`}>{timeIssue || 'ห้องว่างในช่วงที่เลือก พร้อมส่งคำขอจอง'}</p>
          {reserved.length > 0 && <div className="text-sm text-gray-600"><p className="font-semibold">ช่วงเวลาที่มีการจองแล้ว</p>{reserved.map(b=><p key={b.id}>{time(b.start)}–{time(b.end)} น.</p>)}</div>}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Users size={16} className="text-kku-red" /> จำนวนผู้เข้าร่วม
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setParticipants((v) => Math.max(1, v - 1))}
                className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 font-bold text-lg shrink-0 hover:bg-gray-200"
              >
                –
              </button>
              <input
                type="number"
                aria-label="จำนวนผู้เข้าร่วม"
                min={1}
                max={selectedRoom.capacity}
                value={participants}
                onChange={(e) => setParticipants(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-center px-3 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-kku-red"
              />
              <button
                onClick={() => setParticipants((v) => v + 1)}
                className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 font-bold text-lg shrink-0 hover:bg-gray-200"
              >
                +
              </button>
            </div>
            {participants > selectedRoom.capacity && (
              <p className="text-xs text-amber-600 mt-1.5">
                เกินความจุของห้อง (รองรับ {selectedRoom.capacity} ท่าน)
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <FileText size={16} className="text-kku-red" /> วัตถุประสงค์ / หัวข้อประชุม
            </label>
            <textarea
              value={purpose}
              aria-label="วัตถุประสงค์หรือหัวข้อประชุม"
              maxLength={1000}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="ระบุหัวข้อหรือวัตถุประสงค์ของการประชุม..."
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kku-red transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <ImageIcon size={16} className="text-kku-red" /> เอกสารแนบ (ถ้ามี)
            </label>
            <button
              disabled
              className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-sm flex flex-col items-center gap-1 text-gray-400"
            >
                  <ImageIcon size={24} />
                  <span>ยังไม่เปิดรับเอกสารแนบ</span>
            </button>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">ยืมอุปกรณ์เพิ่มเติม</h3>
            <div className="space-y-3 mt-3">
              <p className="text-sm text-gray-600">เลือกจำนวนที่ต้องการยืมเพิ่มเติมจากอุปกรณ์ประจำห้อง</p>
              {equipment.length === 0 && <p role="status" className="text-sm text-gray-600">ยังไม่มีอุปกรณ์เพิ่มเติมเปิดให้ยืม กรุณาติดต่อผู้ดูแลหากต้องการใช้อุปกรณ์</p>}
              {equipment.map(item => {
                const message = equipmentError(item.id, item.remaining);
                const feedbackId = 'equipment-quantity-error-' + item.id;
                return <div key={item.id}>
                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="flex-1">{item.name} · เหลือ {item.remaining}</span>
                    <input aria-label={'จำนวน ' + item.name} type="number" min={0} max={item.remaining} step={1}
                      disabled={busy || item.remaining <= 0} value={quantities[item.id] ?? 0}
                      aria-invalid={!!message} aria-describedby={message ? feedbackId : undefined}
                      onChange={event => setQuantities(q => ({...q, [item.id]: Number(event.target.value)}))}
                      className={'w-20 px-3 py-2 bg-white border rounded-xl focus:outline-none ' + (message ? 'border-red-600 focus:border-red-600' : 'border-gray-200 focus:border-kku-red')} />
                  </label>
                  {message && <p id={feedbackId} role="alert" className="mt-1 text-sm text-red-600">{message}</p>}
                </div>;
              })}
            </div>
          </div>
              <label className="block text-sm text-gray-700">อีเมลผู้เข้าร่วม<textarea aria-label="อีเมลผู้เข้าร่วม" value={participantEmails} onChange={e=>setParticipantEmails(e.target.value)} placeholder="คั่นแต่ละอีเมลด้วยจุลภาค" className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm mt-1"/></label>
        </div>
      </div>

      {/* Submit */}
      <div className="px-4 py-3 bg-white border-t border-gray-100 shrink-0">
        {error && <p role="alert" className="text-sm text-red-600 mb-2">{error}</p>}
        <Button onClick={handleSubmit} disabled={busy || !!timeIssue || hasEquipmentError} size="lg" className="w-full">
          {busy?'กำลังส่งคำขอ…':'ส่งคำขอจอง'}
        </Button>
      </div>
    </div>
  );
}
