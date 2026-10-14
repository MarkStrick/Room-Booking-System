import { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { PhoneFrame, BottomNav, AppHeader } from './components/PhoneFrame';
import { Button } from './components/ui';
import { SearchScreen } from './screens/SearchScreen';
import { BookingScreen } from './screens/BookingScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ChatbotScreen } from './screens/ChatbotScreen';
import { AdminScreen } from './screens/AdminScreen';
import { ChecklistScreen } from './screens/ChecklistScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { useDemo } from '../app/DemoProvider';
import { Profile } from '../features/HelpProfile';
import { Equipment, Locations, ManageRooms, Penalties } from '../features/Administration';
import { Reports } from '../features/Reports';
import { UserAccess } from '../features/UserAccess';
import { EquipmentHandovers, HelpSettings, AdminReadiness, WorkerStatus } from '../features/OperationsControls';
import { ActionDialog } from '../components/ActionDialog';
import type { DialogAction } from '../components/ui';
import type { Screen } from './types';
import { DesktopNav } from './components/DesktopNav';

function Router() {
  const {screen,role,navigate}=useApp();
  const {toast,showToast}=useDemo();
  const [action,setAction]=useState<DialogAction|null>(null);
  useEffect(()=>{setAction(null);},[screen]);
  const adminOnly: Screen[]=['access','locations','equipment','penalties','operations'];
  const staffOnly: Screen[]=['admin','checklist','manage-rooms','reports'];
  const denied=adminOnly.includes(screen)&&role!=='ADMIN'||staffOnly.includes(screen)&&role==='USER';
  let page;
  if(denied||screen==='accessDenied') page=<div className="flex flex-col h-full bg-gray-50"><AppHeader/><div className="flex-1 flex flex-col items-center justify-center px-8 text-center"><ShieldAlert size={44} className="text-red-500 mb-5"/><h2 className="text-xl font-bold mb-2">การเข้าถึงถูกปฏิเสธ</h2><p className="text-sm text-gray-500 mb-8">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p><Button onClick={()=>navigate('search')} className="w-full">กลับหน้าหลัก</Button></div></div>;
  else {
    const pages: Partial<Record<Screen, React.ReactNode>>={search:<SearchScreen/>,booking:<BookingScreen/>,history:<HistoryScreen/>,chatbot:<ChatbotScreen/>,admin:<AdminScreen/>,checklist:<ChecklistScreen/>,notifications:<NotificationsScreen/>};
    const extra: Partial<Record<Screen,React.ReactNode>>={profile:<Profile/>, 'manage-rooms':<ManageRooms open={setAction}/>,locations:<Locations open={setAction}/>,equipment:<Equipment open={setAction}/>,penalties:<Penalties open={setAction}/>,reports:<Reports/>,access:<UserAccess/>,operations:<><EquipmentHandovers/><HelpSettings/><WorkerStatus/><AdminReadiness/></>};
    page=pages[screen] ?? <div className="flex flex-col h-full bg-gray-50"><AppHeader/><div className="legacy-page">{extra[screen]}</div></div>;
  }
  return <div className="reference-workspace">
    <DesktopNav />
    <main className={`reference-main screen-${screen}`}>
    <div key={screen} className="flex-1 min-h-0 overflow-hidden flex flex-col">{page}</div>
    {!denied && <BottomNav/>}
    {action&&<ActionDialog action={action} close={()=>setAction(null)}/>}
    {toast&&<div role="status" className="reference-toast"><span>{toast}</span><button aria-label="ปิดการแจ้งผล" onClick={()=>showToast('')}><X size={16}/></button></div>}
    </main>
  </div>;
}
export function ReferenceApp(){const {user,mode}=useDemo();return <AppProvider key={`${mode}:${user.id}`}><div className="reference-ui"><PhoneFrame><Router/></PhoneFrame></div></AppProvider>;}
