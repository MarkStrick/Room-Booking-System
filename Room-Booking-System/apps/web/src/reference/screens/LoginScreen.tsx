import { CalendarDays, RefreshCw } from 'lucide-react';
import { PhoneFrame } from '../components/PhoneFrame';

export function LoginScreen({ loading, googleReady, error, retry, allowedDomains=[] }: { loading:boolean;googleReady:boolean;error:string;retry:()=>void;allowedDomains?:string[] }) {

  return (
    <div className="reference-ui"><PhoneFrame><div className="flex flex-col bg-gradient-to-b from-kku-red to-kku-red-dark h-full">
      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-white">
        <div className="w-24 h-24 bg-white/15 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/20">
          <CalendarDays size={52} strokeWidth={1.8} />
        </div>
        <h1 className="text-2xl font-bold mb-1 text-center">ระบบจองห้องประชุม</h1>
        <p className="text-white/80 text-sm mb-1">มหาวิทยาลัยขอนแก่น</p>
        <p className="text-white/60 text-xs">Khon Kaen University</p>
      </div>

      {/* Login section */}
      <div className="bg-white rounded-t-3xl px-6 pt-7 pb-8 shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900 mb-1">เข้าสู่ระบบ</h2>
        <p className="text-sm text-gray-500 mb-5">{allowedDomains.length ? `ใช้บัญชี Google ${allowedDomains.map(domain=>`@${domain}`).join(' หรือ ')}` : 'ใช้บัญชี Google เพื่อเข้าสู่ระบบ'}</p>
        {error && <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          disabled={loading || !googleReady}
          onClick={() => location.assign('/api/auth/google')}
          className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          {loading ? 'กำลังเปิดระบบ…' : 'เข้าสู่ระบบด้วย Google'}
        </button>

        {!loading && !googleReady && !error && <p role="status" className="text-xs text-gray-500 mt-3">ระบบเข้าสู่ระบบด้วย Google ยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ</p>}
        {error && <button onClick={retry} className="flex items-center justify-center gap-2 w-full mt-3 text-sm text-kku-red"><RefreshCw size={16}/>ลองเชื่อมต่ออีกครั้ง</button>}

        <p className="text-[11px] text-gray-400 text-center mt-5 leading-relaxed">
          การเข้าสู่ระบบแสดงว่าคุณยอมรับ<br />ข้อกำหนดและเงื่อนไขการใช้งาน
        </p>
      </div>
    </div></PhoneFrame></div>
  );
}
