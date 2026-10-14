import { Building2, Search, CalendarCheck, MessageCircle, Bell, UserRound, ShieldCheck, DoorOpen, BarChart3, Package, Settings2, GraduationCap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { screenLabels } from './PhoneFrame';
import type { Screen } from '../types';

const personal = [
  { screen: 'search', icon: Search },
  { screen: 'history', icon: CalendarCheck },
  { screen: 'chatbot', icon: MessageCircle },
] as const;
const management = [
  { screen: 'admin', icon: ShieldCheck },
  { screen: 'manage-rooms', icon: DoorOpen },
  { screen: 'reports', icon: BarChart3 },
] as const;
const administration = [
  { screen: 'access', icon: UserRound },
  { screen: 'locations', icon: Building2 },
  { screen: 'equipment', icon: Package },
  { screen: 'penalties', icon: ShieldCheck },
  { screen: 'operations', icon: Settings2 },
] as const;
const support = [
  { screen: 'notifications', icon: Bell },
  { screen: 'profile', icon: UserRound },
] as const;

export function DesktopNav() {
  const { screen, role, currentUser, navigate, unreadNotificationCount } = useApp();
  const groups = currentUser.id==='0' ? [{label:'ค้นหาพื้นที่',items:[personal[0]]}] : [
    { label: 'พื้นที่ของคุณ', items: personal },
    ...(role !== 'USER' ? [{ label: 'บริหารพื้นที่', items: management }] : []),
    ...(role === 'ADMIN' ? [{ label: 'จัดการระบบ', items: administration }] : []),
    { label: 'บัญชีของคุณ', items: support },
  ];
  return <aside className="desktop-navigation">
    <a className="desktop-brand" href="#/rooms" aria-label="KKU Space หน้าค้นหาห้อง">
      <img className="reference-university-emblem" src="/brand/kku-emblem-th.png" width={32} height={56} alt="ตราสัญลักษณ์มหาวิทยาลัยขอนแก่น" />
      <span><strong>kku<span>.</span> space</strong><small>มหาวิทยาลัยขอนแก่น</small></span>
    </a>
    <nav aria-label="เมนูหลักสำหรับเดสก์ท็อป">
      {groups.map(group => <div className="desktop-nav-group" key={group.label}>
        <p>{group.label}</p>
        {group.items.map(item => {
          const active = screen === item.screen || item.screen === 'search' && screen === 'booking';
          return <button key={item.screen} onClick={() => navigate(item.screen as Screen)} aria-current={active ? 'page' : undefined}>
            <item.icon size={19} /><span>{screenLabels[item.screen]}</span>
            {item.screen === 'notifications' && unreadNotificationCount > 0 && <b>{unreadNotificationCount}</b>}
          </button>;
        })}
      </div>)}
    </nav>
    <div className="desktop-campus"><GraduationCap size={20}/><span>พื้นที่สำหรับทุกความเป็นไปได้<small>Khon Kaen University</small></span></div>
  </aside>;
}
