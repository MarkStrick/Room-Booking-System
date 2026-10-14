import { ArrowDown, ArrowRight, CalendarDays, Check, ChevronRight, Clock3, DoorOpen, Search, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import './landing.css';

export function LandingPage({ signedIn = false }: { signedIn?: boolean }) {
  const [duration, setDuration] = useState(2);
  return <div className="landing">
    <header className="landing-nav">
      <a href="#/home" className="landing-brand" aria-label="KKU Space หน้าแรก"><img src="/brand/kku-emblem-th.png" alt="ตรามหาวิทยาลัยขอนแก่น" width="30" height="52"/><span>kku<span className="landing-brand-dot">.</span> space<small>มหาวิทยาลัยขอนแก่น</small></span></a>
      <nav aria-label="เมนูหน้าแรก"><a href="#/rooms">ค้นหาห้อง</a><a className="landing-nav-action" href={signedIn ? '#/history' : '#/login'}>{signedIn ? 'การจองของฉัน' : 'เข้าสู่ระบบ'}<ArrowRight size={16}/></a></nav>
    </header>
    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-intro">
          <h1 id="landing-title">พื้นที่ดี ๆ<br/>สำหรับ<span>ไอเดียต่อไป</span></h1>
          <p>ประชุม ทำงานกลุ่ม หรือแบ่งปันไอเดีย<br className="landing-desktop-break"/> ค้นหาห้องในมหาวิทยาลัย แล้วเลือกเวลาที่ใช่สำหรับคุณ</p>
          <div className="landing-actions"><a className="landing-primary" href="#/rooms">ค้นหาห้องว่าง <ArrowRight size={19}/></a><a className="landing-secondary" href="#booking-guide" onClick={e=>{e.preventDefault();document.getElementById('booking-guide')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}>รู้ก่อนจอง <ArrowDown size={17}/></a></div>
          <div className="landing-hero-rule"><Clock3 size={18}/><span>จองได้ <strong>30 นาที–4 ชั่วโมง</strong> ต่อครั้ง</span></div>
        </div>
        <div className="landing-demo" aria-label="ตัวอย่างการเลือกช่วงเวลาจอง">
          <div className="landing-demo-photo"><img src="/room-images/meeting-illustrative.png" alt="ภาพประกอบพื้นที่ประชุม"/><span className="landing-photo-label">ภาพประกอบ</span><div className="landing-photo-caption"><DoorOpen size={20}/><span>พื้นที่สำหรับความคิดใหม่ ๆ<small>ประชุม · ทำงานร่วมกัน · เรียนรู้</small></span></div></div>
          <div className="landing-demo-body">
            <div className="landing-demo-heading"><span><CalendarDays size={18}/> ลองเลือกเวลาของคุณ</span><span className="landing-demo-note">ตัวอย่าง</span></div>
            <div className="landing-demo-time"><div><small>เวลาเริ่ม</small><strong>09:00</strong></div><ArrowRight size={22}/><div><small>เวลาสิ้นสุด</small><strong>{String(9 + duration).padStart(2,'0')}:00</strong></div><span className="landing-duration">{duration} ชั่วโมง</span></div>
            <div className="landing-duration-controls" role="group" aria-label="ทดลองระยะเวลาจอง">{[1,2,3,4].map(hours=><button key={hours} type="button" aria-pressed={duration===hours} onClick={()=>setDuration(hours)}>{hours} ชม.</button>)}</div>
            <p className="landing-demo-feedback"><Check size={16}/> ระยะเวลาอยู่ในเงื่อนไขการจอง</p>
          </div>
          <div className="landing-floating-note"><ShieldCheck size={22}/><span>เลือกเวลาที่ว่าง<small>ก่อนส่งคำขอจอง</small></span></div>
        </div>
      </section>
      <section className="landing-guide" id="booking-guide" aria-labelledby="landing-guide-title">
        <div className="landing-guide-title"><h2 id="landing-guide-title">รู้ก่อนจอง<br/><span>แล้วเริ่มได้เลย</span></h2><p>เช็กเงื่อนไขสักนิด เพื่อให้ทุกคน<br/>ใช้พื้นที่ร่วมกันได้อย่างราบรื่น</p></div>
        <dl className="landing-rules"><div><dt><Clock3 size={21}/> ระยะเวลาต่อครั้ง</dt><dd><strong>30 นาที — 4 ชั่วโมง</strong><p>เลือกช่วงเวลาต่อเนื่องที่ยังว่าง ไม่ทับกับการจองอื่น</p></dd></div><div><dt><CalendarDays size={21}/> วางแผนล่วงหน้า</dt><dd><strong>จองล่วงหน้าได้ไม่เกิน 15 วัน</strong><p>ตรวจเวลาทำการของแต่ละห้อง และวันหยุดก่อนจอง</p></dd></div><div><dt><Users size={21}/> บัญชีสำหรับการจอง</dt><dd><strong>ใช้บัญชี Google ของมหาวิทยาลัย</strong><p>เข้าสู่ระบบก่อนส่งคำขอ และติดตามผลการอนุมัติได้ในระบบ</p></dd></div></dl>
      </section>
      <section className="landing-flow" aria-labelledby="landing-flow-title"><div><h2 id="landing-flow-title">จากไอเดีย สู่พื้นที่ของคุณ</h2><p>ค้นหา เลือกเวลา แล้วส่งคำขอจอง</p></div><ol><li><Search size={21}/><span><strong>ค้นหาห้อง</strong><small>เลือกอาคารและขนาดที่เหมาะสม</small></span><ChevronRight size={19}/></li><li><Clock3 size={21}/><span><strong>เลือกช่วงเวลา</strong><small>ตรวจช่วงที่ห้องเปิดและยังว่าง</small></span><ChevronRight size={19}/></li><li><ShieldCheck size={21}/><span><strong>ส่งคำขอจอง</strong><small>ติดตามผลในหน้าการจองของฉัน</small></span></li></ol><a href="#/rooms" className="landing-primary">เริ่มค้นหาห้อง <ArrowRight size={18}/></a></section>
    </main>
    <footer className="landing-footer"><span>kku. space <small>ระบบจองห้องประชุม มหาวิทยาลัยขอนแก่น</small></span><a href="#/rooms">ไปยังหน้าค้นหาห้อง <ArrowRight size={16}/></a></footer>
  </div>;
}
