import { ArrowLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import './login.css';

export function LoginScreen({ loading, googleReady, error, retry, allowedDomains=[] }: { loading:boolean;googleReady:boolean;error:string;retry:()=>void;allowedDomains?:string[] }) {

  return (
    <div className="reference-ui login-page-shell">
      <main className="login-scene">
        <header className="login-topbar">
          <a href="#/home" className="login-wordmark">kku<span>.</span> space</a>
          <a href="#/rooms" className="login-browse">ค้นหาห้อง <ArrowUpRight size={16} aria-hidden="true" /></a>
        </header>
        <div className="login-layout">
          <section className="login-brand" aria-labelledby="login-brand-title">
            <div className="login-emblem"><img src="/brand/kku-emblem-th.png" width="82" height="146" alt="ตราสัญลักษณ์มหาวิทยาลัยขอนแก่น" /></div>
            <p className="login-eyebrow">KHON KAEN UNIVERSITY</p>
            <h1 id="login-brand-title">พื้นที่สำหรับทุกไอเดีย<span>เริ่มต้นที่นี่</span></h1>
            <p className="login-brand-description">ระบบจองห้องประชุม มหาวิทยาลัยขอนแก่น</p>
          </section>
          <section className="login-glass-card" aria-labelledby="login-title" aria-busy={loading}>
            <p className="login-card-eyebrow">ยินดีต้อนรับสู่ KKU Space</p>
            <h2 id="login-title">เข้าสู่ระบบ</h2>
            <p className="login-intro">เข้าสู่ระบบเพื่อจองห้องและจัดการการจองของคุณ</p>
            <p className="login-domains">{allowedDomains.length ? `ใช้บัญชี Google ${allowedDomains.map(domain=>`@${domain}`).join(' หรือ ')}` : 'ใช้บัญชี Google ของคุณ'}</p>
            {error && <p role="alert" className="login-message login-error">{error}</p>}

        <button
          disabled={loading || !googleReady}
          onClick={() => location.assign('/api/auth/google')}
          className="login-google-button"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          {loading ? 'กำลังเปิดระบบ…' : 'เข้าสู่ระบบด้วย Google'}
        </button>

            {!loading && !googleReady && !error && <p role="status" className="login-message">ระบบเข้าสู่ระบบด้วย Google ยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ</p>}
            {error && <button onClick={retry} className="login-retry"><RefreshCw size={16} aria-hidden="true" />ลองเชื่อมต่ออีกครั้ง</button>}
            <div className="login-divider"><span>หรือสำรวจห้องก่อนได้</span></div>
            <button onClick={()=>{history.replaceState(null,'',location.pathname);location.hash='#/rooms';}} className="login-room-link"><ArrowLeft size={16} aria-hidden="true" />กลับไปค้นหาห้อง</button>
            <a href="#/home" className="login-home-link">กลับหน้าแรก</a>
            <p className="login-terms">การเข้าสู่ระบบแสดงว่าคุณยอมรับ<br />ข้อกำหนดและเงื่อนไขการใช้งาน</p>
          </section>
        </div>
        <footer className="login-footer"><span>มหาวิทยาลัยขอนแก่น</span><span>KKU Space · ระบบจองห้องประชุม</span></footer>
      </main>
    </div>
  );
}
