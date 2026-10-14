import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { useDemo } from '../../app/DemoProvider';
import { AppHeader } from '../components/PhoneFrame';
import { Send, Bot, User as UserIcon, Users, MapPin, Search, ArrowRight } from 'lucide-react';
import { useAsyncAction } from '../useAsyncAction';
import type { AssistantSearch } from '../../../../../packages/contracts/src/assistant';
import { addDays, stamp, thaiDate, time } from '../../lib/domain';
import './chatbot.css';

function SearchDetails({ search, busy, submit }: { search: AssistantSearch; busy: boolean; submit: (filters: AssistantSearch) => void }) {
  const { today } = useApp();
  const [filters, setFilters] = useState(search);
  const [overnight, setOvernight] = useState(!!search.endDate && search.endDate !== search.date);
  const change = (key: keyof AssistantSearch, value: string | number) => setFilters(previous => ({ ...previous, [key]: value }));
  function send(event: FormEvent) {
    event.preventDefault();
    submit({ ...filters, endDate: overnight ? addDays(filters.date, 1) : filters.date });
  }
  return <form className="assistant-search-form" onSubmit={send}>
    <div className="assistant-fields">
      <label>วันที่<input type="date" required min={today} max={addDays(today,15)} value={filters.date} onChange={e => change('date',e.target.value)} /></label>
      <label>จำนวนคน<input type="number" required min={1} max={10000} value={filters.capacity} onChange={e => change('capacity', Number(e.target.value))} /></label>
      <label>ตั้งแต่<input type="time" required value={filters.start} onChange={e => change('start',e.target.value)} /></label>
      <label>ถึง<input type="time" required value={filters.end} onChange={e => change('end',e.target.value)} /></label>
    </div>
    <label className="assistant-overnight"><input type="checkbox" checked={overnight} onChange={e => setOvernight(e.target.checked)} /> สิ้นสุดวันถัดไป</label>
    <label>อาคาร (ไม่ระบุ = ทุกอาคาร)<input maxLength={100} value={filters.building} onChange={e => change('building',e.target.value)} placeholder="ชื่ออาคาร" /></label>
    <label>ชื่อห้อง (ไม่ระบุ = ทุกห้อง)<input maxLength={100} value={filters.roomQuery} onChange={e => change('roomQuery',e.target.value)} placeholder="ชื่อหรือรหัสห้อง" /></label>
    <label>อุปกรณ์ประจำห้อง<input maxLength={800} value={filters.amenities.join(', ')} placeholder="เช่น โปรเจกเตอร์, ไวไฟ" onChange={e => setFilters(previous => ({ ...previous, amenities: e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0,8) }))} /></label>
    <button type="submit" disabled={busy} className="assistant-primary"><Search size={16} />ค้นหาตามเงื่อนไข</button>
  </form>;
}

export function ChatbotScreen() {
  const { chatMessages, sendChatMessage, touchChat, rooms, setSelectedRoom, setSearchSlot, navigate, today } = useApp();
  const { mode, showToast } = useDemo();
  const [input, setInput] = useState('');
  const { busy: isTyping, error, perform } = useAsyncAction();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const container = scrollRef.current, last = lastMessageRef.current;
    if (!container) return;
    if (!isTyping && last) container.scrollTop += last.getBoundingClientRect().top - container.getBoundingClientRect().top - 12;
    else container.scrollTop = container.scrollHeight;
  }, [chatMessages.length, isTyping]);
  const send = (text: string, filters?: AssistantSearch) => {
    if (!text.trim() || isTyping) return;
    void perform(() => sendChatMessage(text.trim(), filters), () => { setInput(previous => previous.trim() === text.trim() ? '' : previous); inputRef.current?.focus(); });
  };
  const lastBot = [...chatMessages].reverse().find(m => m.sender === 'bot');
  const quickActions = ['วันนี้มีห้องไหนว่างบ้าง', 'พรุ่งนี้ 10:00–12:00 มีห้องสำหรับ 10 คนไหม', 'จะจองห้องยังไง?', 'ยกเลิกการจองอย่างไร?'];
  function book(roomId: number, search: AssistantSearch) {
    const room = rooms.find(r => Number(r.id) === roomId);
    if (!room) { showToast('ห้องนี้ไม่อยู่ในรายการปัจจุบัน กรุณาค้นหาใหม่'); return; }
    setSelectedRoom(room); setSearchSlot(search); navigate('booking');
  }
  return <div className="assistant-screen flex flex-col h-full bg-gray-50" onPointerDownCapture={touchChat} onKeyDownCapture={touchChat}>
    <AppHeader showBack={false} title="ผู้ช่วยมข." />
    <div className="assistant-info">
      <Bot size={24} aria-hidden="true" />
      <div><p>ผู้ช่วยค้นหาและจองห้อง</p><span>{mode === 'demo' ? 'พื้นที่จำลอง • ค้นจากข้อมูลสาธิต' : 'ค้นห้องว่างจากระบบ • ตอบจากคู่มือของเว็บ'}</span></div>
    </div>
    <div ref={scrollRef} className="assistant-messages" role="log" aria-label="บทสนทนากับผู้ช่วย" aria-live="polite" aria-relevant="additions" aria-busy={isTyping}>
      {chatMessages.map((msg, index) => <div key={msg.id} ref={index === chatMessages.length - 1 ? lastMessageRef : undefined} className={`assistant-message ${msg.sender === 'user' ? 'assistant-user' : ''}`}>
        <div className="assistant-avatar" aria-hidden="true">{msg.sender === 'bot' ? <Bot size={17} /> : <UserIcon size={17} />}</div>
        <div className="assistant-message-body">
          <p className="assistant-bubble">{msg.text}</p>
          {msg.response?.search && !msg.response.needsDetails && <p className="assistant-criteria">{thaiDate(stamp(msg.response.search.date,'12:00'),true)} · {msg.response.search.start}–{msg.response.search.end} · {msg.response.search.capacity} คนขึ้นไป{msg.response.search.amenities.length ? ` · ${msg.response.search.amenities.join(', ')}` : ''}</p>}
          {!!msg.response?.rooms.length && msg.response.search && <ul className="assistant-room-list">
            {msg.response.rooms.map(room => <li key={room.id}>
              <strong>{room.name}</strong>
              <span><MapPin size={14} />{room.building}</span><span><Users size={14} />รองรับ {room.capacity} คน</span>
              {!!room.amenities.length && <small>{room.amenities.join(' · ')}</small>}
              <button type="button" disabled={isTyping} onClick={() => book(room.id,msg.response!.search!)}>เลือกห้องนี้<ArrowRight size={16} /></button>
            </li>)}
          </ul>}
          {msg.response && <p className="assistant-source">
            {msg.response.source === 'catalog' ? `ตรวจข้อมูล${msg.response.mode === 'demo' ? 'จำลอง' : 'ระบบ'} ${time(msg.response.checkedAt)} น.` : msg.response.source === 'faq' ? 'จาก FAQ ของเว็บ' : 'จากคู่มือของเว็บ'}
            {msg.response.mode === 'gemini' ? ' · ตีความด้วย Gemini' : msg.response.mode === 'fallback' ? ' · โหมดพื้นฐาน' : ''}
          </p>}
          {msg.response?.rooms.length ? <p className="assistant-source">ระบบจะตรวจห้องว่างอีกครั้งเมื่อส่งคำขอจอง</p> : null}
          {msg.id === lastBot?.id && msg.response?.search && !isTyping && <details className="assistant-adjust" open={msg.response.needsDetails || undefined}>
            <summary>{msg.response.needsDetails ? 'ระบุวันและเวลาที่ต้องการ' : 'ปรับเงื่อนไขค้นหา'}</summary>
            <SearchDetails search={{ ...msg.response.search, date: msg.response.search.date || today }} busy={isTyping} submit={filters => send('ค้นหาห้องว่างตามเงื่อนไขที่เลือก', filters)} />
          </details>}
          {msg.id === lastBot?.id && msg.response?.faqQuestions && <div className="assistant-suggestions">{msg.response.faqQuestions.map(q => <button type="button" key={q} disabled={isTyping} onClick={() => send(q)}>{q}</button>)}</div>}
        </div>
      </div>)}
      {isTyping && <p className="assistant-typing" role="status">กำลังตรวจข้อมูลและเตรียมคำตอบ…</p>}
    </div>
    {chatMessages.length <= 1 && <div className="assistant-quick-actions"><p>ลองถามผู้ช่วย</p><div>{quickActions.map(q => <button key={q} type="button" disabled={isTyping} onClick={() => send(q)}>{q}</button>)}</div></div>}
    <form className="assistant-composer" onSubmit={event => { event.preventDefault(); send(input); }}>
      {error && <p role="alert" className="assistant-error">{error} ลองส่งข้อความใหม่ได้ครับ</p>}
      <div><input ref={inputRef} value={input} aria-label="ข้อความถึงผู้ช่วย" aria-describedby="assistant-hint" maxLength={1000} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault(); }} placeholder="เช่น พรุ่งนี้ 14:00–16:00 สำหรับ 10 คน" /><button type="submit" aria-label="ส่งข้อความ" disabled={!input.trim() || isTyping}><Send size={19} /></button></div>
      <p id="assistant-hint">แชตคงอยู่หลังรีเฟรช · เริ่มใหม่เมื่อไม่ได้ใช้งาน 10 นาที · กรุณาไม่พิมพ์ข้อมูลส่วนตัว</p>
    </form>
  </div>;
}
