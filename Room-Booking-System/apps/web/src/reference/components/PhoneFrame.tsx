import { useState } from 'react';
import { Bell, Building2, ChevronDown, ChevronLeft, ChevronRight, Grid2X2, LogOut, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Screen } from '../types';

export const screenLabels: Record<Screen, string> = {
  login: 'เข้าสู่ระบบ',
  search: 'ค้นหาห้องว่าง',
  booking: 'จองห้องประชุม',
  chatbot: 'ผู้ช่วย',
  history: 'ประวัติการจอง',
  admin: 'อนุมัติการจอง',
  checklist: 'ตรวจสภาพห้อง',
  notifications: 'การแจ้งเตือน',
  accessDenied: 'การเข้าถึงถูกปฏิเสธ',
  profile: 'ข้อมูลส่วนตัว', 'manage-rooms': 'จัดการห้อง', locations: 'อาคารและวันหยุด', equipment: 'อุปกรณ์ส่วนกลาง', penalties: 'พิจารณาบทลงโทษ', reports: 'รายงานการใช้งาน', access: 'บัญชีและสิทธิ์', operations: 'การตั้งค่าและการดำเนินงาน',
};

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="reference-stage">
      <div className="reference-frame">
        {children}
      </div>
    </div>
  );
}

export function AppHeader({ title, showBack = true }: { title?: string; showBack?: boolean }) {
  const { goBack, screen, currentUser, logout, navigate, unreadNotificationCount, refresh, role } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);

  if (showBack) {
    return (
      <div className="reference-page-header flex items-center gap-3 px-4 h-14 bg-white border-b border-gray-100 shrink-0 z-10">
        <button onClick={goBack} aria-label="กลับหน้าก่อนหน้า" className="p-1 -ml-1 text-gray-700 hover:text-kku-red transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">
          {title ?? screenLabels[screen]}
        </h1>
      </div>
    );
  }

  return (
    <div className="reference-app-header relative bg-white border-b border-gray-100 shrink-0 z-20">
      <div className="h-[72px] px-4 flex items-center gap-3">
        <div className="reference-header-brand flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-kku-red flex items-center justify-center shadow-sm shadow-red-900/20">
            <Building2 size={23} className="text-white" />
          </div>
          <span className="text-[25px] leading-none font-black tracking-tight text-gray-900">kku<span className="text-kku-red">.</span></span>
        </div>
        <div className="reference-header-divider h-9 w-px bg-gray-200" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-bold">พื้นที่ทำงาน</p>
          <p className="text-sm font-bold text-gray-800 truncate">ระบบจองห้องประชุม</p>
        </div>
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setProfileOpen((open) => !open)}
              className="flex items-center gap-1.5 rounded-full hover:bg-gray-50 p-1 transition-colors"
              aria-label="เปิดเมนูบัญชี"
              aria-expanded={profileOpen}
            >
              <span className="w-9 h-9 rounded-full bg-red-50 text-kku-red flex items-center justify-center font-bold ring-2 ring-red-50">{currentUser.name.charAt(0)}</span>
              <span className="reference-account-name">{currentUser.name}</span>
              <ChevronDown size={16} className={`text-gray-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 w-64 max-h-[70dvh] overflow-y-auto scrollbar-hide rounded-2xl bg-white border border-gray-100 shadow-xl shadow-gray-900/10 p-2 animate-scale-in">
                <div className="px-3 py-2.5">
                  <p className="text-sm font-bold text-gray-900 truncate">{currentUser.name}</p>
                  <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
                </div>
                <button onClick={()=>navigate('profile')} className="w-full text-left px-3 py-2.5 rounded-xl text-gray-700 text-sm hover:bg-gray-50">ข้อมูลส่วนตัว</button>
                <button onClick={()=>navigate('notifications')} className="w-full text-left px-3 py-2.5 rounded-xl text-gray-700 text-sm hover:bg-gray-50">การแจ้งเตือน</button>
                {role!=='USER' && <>
                  <button onClick={()=>navigate('manage-rooms')} className="w-full text-left px-3 py-2.5 rounded-xl text-gray-700 text-sm hover:bg-gray-50">จัดการห้อง</button>
                  <button onClick={()=>navigate('reports')} className="w-full text-left px-3 py-2.5 rounded-xl text-gray-700 text-sm hover:bg-gray-50">รายงานการใช้งาน</button>
                  <button onClick={()=>navigate('history')} className="w-full text-left px-3 py-2.5 rounded-xl text-gray-700 text-sm hover:bg-gray-50">ประวัติการจองของฉัน</button>
                </>}
                {role==='ADMIN' && <>
                  {(['access','locations','equipment','penalties','operations'] as const).map(s=><button key={s} onClick={()=>navigate(s)} className="w-full text-left px-3 py-2.5 rounded-xl text-gray-700 text-sm hover:bg-gray-50">{screenLabels[s]}</button>)}
                </>}
                <button
                  onClick={() => { logout(); setProfileOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 text-kku-red text-sm font-semibold hover:bg-red-100 transition-colors"
                >
                  <LogOut size={17} /> ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="h-11 px-4 flex items-center gap-2 bg-gray-50/80 border-t border-gray-100">
        <Grid2X2 size={17} className="text-gray-400" />
        <span className="text-sm text-gray-500"><span className="reference-mobile-copy">Workspace</span><span className="reference-desktop-copy">พื้นที่มหาวิทยาลัย</span></span>
        <ChevronRight size={15} className="text-gray-300" />
        <span className="text-sm font-bold text-gray-800 truncate">{title ?? screenLabels[screen]}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={()=>void refresh()} className="p-1.5 rounded-lg text-gray-400 hover:text-kku-red hover:bg-white transition-colors" aria-label="รีเฟรช">
            <RefreshCw size={18} />
          </button>
          {currentUser && (
            <button onClick={() => navigate('notifications')} className={`${role==='USER'?'reference-user-notifications':''} relative p-1.5 rounded-lg text-gray-400 hover:text-kku-red hover:bg-white transition-colors`} aria-label="การแจ้งเตือน">
              <Bell size={19} />
              {unreadNotificationCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 bg-kku-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const userNavItems = [
  { screen: 'search' as const, label: 'ค้นหา', icon: 'search' },
  { screen: 'history' as const, label: 'ประวัติ', icon: 'history' },
  { screen: 'chatbot' as const, label: 'แชท', icon: 'chat' },
];

const adminNavItems = [
  { screen: 'admin' as const, label: 'อนุมัติ', icon: 'admin' },
  { screen: 'search' as const, label: 'ค้นหา', icon: 'search' },
  { screen: 'chatbot' as const, label: 'แชท', icon: 'chat' },
];

import { Search, History, MessageCircle, ShieldCheck } from 'lucide-react';

export function BottomNav() {
  const { screen, navigate, currentUser } = useApp();
  if (screen === 'login' || screen === 'booking' || screen === 'checklist' || screen === 'notifications' || screen === 'accessDenied') return null;

  const isAdmin = currentUser?.role === 'admin';
  const items = isAdmin ? adminNavItems : userNavItems;

  return (
    <div className="reference-bottom-nav h-16 bg-white border-t border-gray-100 flex items-center justify-around shrink-0 pb-1">
      {items.map((item) => {
        const Icon = item.icon === 'search' ? Search : item.icon === 'history' ? History : item.icon === 'chat' ? MessageCircle : ShieldCheck;
        const active = screen === item.screen;
        return (
          <button
            key={item.screen}
            onClick={() => navigate(item.screen)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${active ? 'text-kku-red' : 'text-gray-400'}`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            <span className={`text-[11px] font-semibold ${active ? 'text-kku-red' : 'text-gray-400'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
