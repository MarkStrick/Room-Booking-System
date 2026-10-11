import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppHeader } from '../components/PhoneFrame';
import { Button } from '../components/ui';
import { Users, Calendar, Clock, MapPin, CheckCircle2, FileText, Image as ImageIcon } from 'lucide-react';
import { useAsyncAction } from '../useAsyncAction';
import { RoomImage } from '../components/RoomImage';

export function BookingScreen() {
  const { selectedRoom, addBooking, navigate, searchSlot, equipment } = useApp();
  const [date, setDate] = useState(searchSlot.date);
  const [startTime, setStartTime] = useState(searchSlot.start || '09:00');
  const [endTime, setEndTime] = useState(searchSlot.end || '11:00');
  const [participants, setParticipants] = useState(Math.min(10,selectedRoom?.capacity??10));
  const [purpose, setPurpose] = useState('');
  const [extraOpen,setExtraOpen]=useState(false);
  const [participantEmails,setParticipantEmails]=useState('');
  const [quantities,setQuantities]=useState<Record<number,number>>({});
  const [success, setSuccess] = useState(false);
  const {busy,error,perform}=useAsyncAction();
  useEffect(()=>{if(!selectedRoom)navigate('search');},[selectedRoom]);

  if (!selectedRoom) {
    return null;
  }

  const handleSubmit = () => perform(async () => {
    if(!date || !startTime || !endTime || endTime<=startTime)throw new Error('กรุณาเลือกวันที่และเวลาให้ถูกต้อง');
    if(!purpose.trim())throw new Error('กรุณาระบุวัตถุประสงค์ของการจอง');
    if(!Number.isInteger(participants)||participants<1||participants>selectedRoom.capacity)throw new Error(`จำนวนผู้เข้าร่วมต้องอยู่ระหว่าง 1–${selectedRoom.capacity} ท่าน`);
    await addBooking({
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      building: selectedRoom.building,
      date,
      startTime,
      endTime,
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
          </div>
        </div>

        {/* Form */}
        <div className="booking-form-fields space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={16} className="text-kku-red" /> วันที่ต้องการจอง
            </label>
            <input
              type="date"
              aria-label="วันที่ต้องการจอง"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kku-red transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Clock size={16} className="text-kku-red" /> เวลาเริ่ม
              </label>
              <input
                type="time"
                aria-label="เวลาเริ่ม"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kku-red transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Clock size={16} className="text-kku-red" /> เวลาสิ้นสุด
              </label>
              <input
                type="time"
                aria-label="เวลาสิ้นสุด"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kku-red transition-colors"
              />
            </div>
          </div>

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
            <button onClick={()=>setExtraOpen(v=>!v)} aria-expanded={extraOpen} className="text-sm font-semibold text-kku-red">ผู้เข้าร่วมและอุปกรณ์เพิ่มเติม</button>
            {extraOpen && <div className="space-y-3 mt-3">
              <label className="block text-sm text-gray-700">อีเมลผู้เข้าร่วม<textarea aria-label="อีเมลผู้เข้าร่วม" value={participantEmails} onChange={e=>setParticipantEmails(e.target.value)} placeholder="คั่นแต่ละอีเมลด้วยจุลภาค" className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm mt-1"/></label>
              {equipment.map(e=><label key={e.id} className="flex items-center gap-3 text-sm text-gray-700"><span className="flex-1">{e.name} · เหลือ {e.remaining}</span><input aria-label={`จำนวน ${e.name}`} type="number" min={0} max={e.remaining} value={quantities[e.id]??0} onChange={event=>setQuantities(q=>({...q,[e.id]:Math.max(0,Number(event.target.value))}))} className="w-20 px-3 py-2 bg-white border border-gray-200 rounded-xl"/></label>)}
            </div>}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="px-4 py-3 bg-white border-t border-gray-100 shrink-0">
        {error && <p role="alert" className="text-sm text-red-600 mb-2">{error}</p>}
        <Button onClick={handleSubmit} disabled={busy} size="lg" className="w-full">
          {busy?'กำลังส่งคำขอ…':'ส่งคำขอจอง'}
        </Button>
      </div>
    </div>
  );
}
