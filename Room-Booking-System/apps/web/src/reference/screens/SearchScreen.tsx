import { TimeSelect } from '../components/TimeSelect';
import { useDemo } from '../../app/DemoProvider';
import { searchSlotError } from '../../../../../packages/core/src/search';
import { addDays, availability, stamp } from '../../lib/domain';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppHeader } from '../components/PhoneFrame';
import { Users, MapPin, Clock, Search as SearchIcon, SlidersHorizontal, CalendarDays, DoorOpen, ChevronRight } from 'lucide-react';
import { RoomImage } from '../components/RoomImage';

export function SearchScreen() {
  const { rooms, navigate, setSelectedRoom, roomAvailable, searchSlot, setSearchSlot, currentUser } = useApp();
  const {state}=useDemo();
  const [buildingId,setBuildingId]=useState('');
  const [searchText, setSearchText] = useState('');
  const [capacityFilter, setCapacityFilter] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const {date,start:time,end:endT}=searchSlot;
  const setDate=(date:string)=>setSearchSlot({...searchSlot,date,endDate:searchSlot.endDate&&searchSlot.endDate!==searchSlot.date?addDays(date,1):undefined});
  const setTime=(start:string)=>setSearchSlot({...searchSlot,start});
  const setEndT=(end:string)=>setSearchSlot({...searchSlot,end});

  const slotError=searchSlotError(state,date,time,endT,searchSlot.endDate??date);
  const needsTime = !date || !time || !endT;
  const canSelect = (room: typeof rooms[0]) => needsTime
    ? state.rooms.some(r => String(r.id) === room.id && r.status === 'AVAILABLE')
    : roomAvailable(room,date,time,endT,searchSlot.endDate);
  const filtered = rooms.filter((room) => {
    const matchText = !searchText || room.name.includes(searchText) || room.building.includes(searchText);
    const matchCap = !capacityFilter || room.capacity >= capacityFilter;
    return matchText && matchCap && (!buildingId || state.rooms.find(r=>String(r.id)===room.id)?.buildingId===Number(buildingId));
  });

  const availableCount=filtered.filter(r=>roomAvailable(r,date,time,endT,searchSlot.endDate)).length;
  const statusFor=(id:string)=>{const r=state.rooms.find(r=>String(r.id)===id)!;return r.status!=='AVAILABLE'?{label:r.status==='MAINTENANCE'?'ปิดปรับปรุง':'ปิดให้บริการ',reason:r.reason}:slotError?{label:'รอเลือกช่วงเวลา',reason:''}:availability(state,r,stamp(date,time),stamp(searchSlot.endDate??date,endT));};
  const handleSelect = (room: typeof rooms[0]) => {
    if(currentUser.id==='0')sessionStorage.setItem('kku-booking-intent',JSON.stringify({roomId:room.id,slot:searchSlot}));
    setSelectedRoom(room);
    navigate('booking');
  };

  return (
    <div className="search-screen flex flex-col h-full bg-gray-50">
      <AppHeader showBack={false} />

      <div className="search-content flex-1 min-h-0 overflow-y-auto">
      <section className="search-overview" aria-labelledby="search-overview-title">
        <h2 id="search-overview-title">ภาพรวมการจองวันนี้</h2>
        <p className="search-overview-date"><CalendarDays size={16} aria-hidden="true" />{new Intl.DateTimeFormat('th-TH', { dateStyle: 'full' }).format(new Date())}</p>
        <div className="search-welcome">
          <span className="search-welcome-icon"><DoorOpen size={24} strokeWidth={1.75} aria-hidden="true" /></span>
          <div className="search-welcome-copy">
            <p>พร้อมให้บริการ</p>
            <p>ค้นหาห้องที่เหมาะกับการประชุมของคุณ</p>
          </div>
          <span className="search-availability"><strong>{slotError ? '—' : availableCount}</strong><span>{slotError ? 'เลือกเวลา' : 'ห้องว่าง'}</span></span>
        </div>
      </section>

      {/* Search controls */}
      <div className="search-controls px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchText}
              aria-label="ค้นหาชื่อห้องหรืออาคาร"
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ค้นหาชื่อห้อง / อาคาร..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kku-red focus:bg-white transition-colors"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-label="ตัวกรองจำนวนผู้เข้าร่วม"
            aria-expanded={showFilters}
            className={`px-3 rounded-xl border transition-colors ${showFilters ? 'bg-kku-red text-white border-kku-red' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

<label className="block text-sm text-gray-700 mt-3">อาคาร<select aria-label="อาคาร" value={buildingId} onChange={e=>setBuildingId(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"><option value="">ทุกอาคาร</option>{state.buildings.filter(b=>b.active!==false).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <div className="search-date-fields flex gap-2 mt-2.5">
          <label><span className="desktop-field-label">วันที่ต้องการจอง</span>
          <input
            type="date"
            aria-label="วันที่ต้องการจอง"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="reference-date flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-kku-red"
          />
          </label>
          <label><span className="desktop-field-label">เวลาเริ่ม</span>
          <TimeSelect
            aria-label="เวลาเริ่ม"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-24 px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-kku-red"
          />
          </label>
          <label><span className="desktop-field-label">เวลาสิ้นสุด</span>
          <TimeSelect
            aria-label="เวลาสิ้นสุด"
            value={endT}
            onChange={(e) => setEndT(e.target.value)}
            className="w-24 px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-kku-red"
          />
          </label>
        </div>

        <label className="flex items-center gap-2 mt-3 text-sm text-gray-700"><input type="checkbox" checked={!!searchSlot.endDate&&searchSlot.endDate!==date} onChange={e=>setSearchSlot({...searchSlot,endDate:e.target.checked?addDays(date,1):undefined})}/> สิ้นสุดในวันถัดไป (เฉพาะห้องที่เปิดข้ามคืน)</label>

        {showFilters && (
          <div className="mt-3 animate-slide-up">
            <p className="text-xs font-semibold text-gray-500 mb-2">จำนวนผู้เข้าร่วมขั้นต่ำ</p>
            <div className="flex gap-2 flex-wrap">
              {[null, 10, 20, 30, 50].map((cap) => (
                <button
                  key={cap ?? 'all'}
                  onClick={() => setCapacityFilter(cap)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    capacityFilter === cap ? 'bg-kku-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cap === null ? 'ทั้งหมด' : `${cap}+ ท่าน`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="search-results px-4 py-3">
        {slotError && <p role="status" className="text-sm text-gray-600 mb-3">{needsTime ? 'กดแบนเนอร์ห้องเพื่อเลือกวันและเวลาจอง หรือเลือกเวลาที่ด้านบนเพื่อเช็คห้องว่าง' : slotError}</p>}
        <p className="text-sm font-semibold text-gray-700 mb-3">
          พบ {filtered.length} ห้อง{!slotError && ` · ว่าง ${availableCount} ห้องในช่วงเวลาที่เลือก`}
        </p>

        <div className="search-room-grid">
          {filtered.map((room) => (
            <button
              key={room.id}
              disabled={!canSelect(room)}
              aria-label={`เลือกวันและเวลาจอง ${room.name}`}
              onClick={() => handleSelect(room)}
              className="search-room-card w-full bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-kku-red/30 hover:shadow-lg transition-all text-left active:scale-[0.99] group"
            >
              <div className="search-room-photo relative h-36 overflow-hidden">
                <RoomImage key={room.imageUrl} src={room.imageUrl} name={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                  <div>
                    <h3 className="text-white font-bold text-base">{room.name}</h3>
                    <p className="text-white/80 text-xs flex items-center gap-1">
                      <MapPin size={12} /> {room.building} · {room.floor}
                    </p>
                  </div>
                  <span className="text-white text-xs bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                    <Users size={12} /> {room.capacity}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                  <Clock size={14} /> {room.openTime ? `เปิดให้บริการ ${room.openTime} - ${room.closeTime} น.` : 'กรุณาสอบถามเวลาให้บริการจากผู้ดูแล'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {room.amenities.slice(0, 4).map((a) => (
                    <span key={a} className="text-[11px] px-2 py-0.5 bg-red-50 text-kku-red rounded-full font-medium">
                      {a}
                    </span>
                  ))}
                  {room.amenities.length > 4 && (
                    <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                      +{room.amenities.length - 4}
                    </span>
                  )}
                </div>
<p className="text-sm text-gray-700 mt-3">{statusFor(room.id).label}{statusFor(room.id).reason ? ` · ${statusFor(room.id).reason}` : ""}</p>
                {canSelect(room) && <span className="desktop-room-action">{needsTime ? 'เลือกเวลาจอง' : 'ดูรายละเอียดและจอง'} <ChevronRight size={16}/></span>}
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <SearchIcon size={48} strokeWidth={1.5} />
            <p className="mt-3 text-sm">ไม่พบห้องที่ตรงกับเงื่อนไข</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
