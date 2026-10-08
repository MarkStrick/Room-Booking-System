import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from "react";
import type {
  AppState,
  Command,
  User,
} from "../../../../packages/contracts/src/index";
import { mockApi } from "../lib/mock-api";
import { createSeed } from "../lib/seed";
import { ApiError, request, sendCommand, type PublicConfig, type Session } from '../lib/api';
import { DoorOpen, LogIn, RefreshCw } from 'lucide-react';
import { Brand } from '../components/Brand';
import { PasswordLogin } from '../components/PasswordLogin';
const subscribeAuth=(cb:()=>void)=>{window.addEventListener('hashchange',cb);return()=>window.removeEventListener('hashchange',cb);};
const getAuthRoute=()=>location.hash.replace(/^#\/?/,'').split('?')[0];

interface DemoContextValue {
  state: AppState;
  user: User;
  switchUser: (id: number) => void;
  run: (command: Command, message?: string) => Promise<void>;
  reset: () => void;
  toast: string;
  showToast: (message: string) => void;
  persistent: boolean;
  mode: 'demo' | 'server';
  logout: () => Promise<void>;
  manageAccess: (userId:number,role:User['role'],roomIds:number[],active:boolean)=>Promise<void>;
  hasPassword:boolean;
  setPassword:(password:string,currentPassword?:string)=>Promise<void>;
}
const DemoContext = createContext<DemoContextValue | null>(null);
function PrototypeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(mockApi.load);
  const stateRef = useRef(state);
  const [userId, setUserId] = useState(1);
  const [toast, showToast] = useState("");
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => showToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const user = state.users.find((u) => u.id === userId) ?? state.users[0];
  async function run(command: Command, message = "บันทึกสำเร็จ") {
    const next = await mockApi.command(
      () => stateRef.current,
      user.id,
      command,
    );
    stateRef.current = next;
    setState(next);
    setPersistent(mockApi.save(next));
    if (message) showToast(message);
  }
  function reset() {
    const next = createSeed();
    stateRef.current = next;
    setState(next);
    setUserId(1);
    setPersistent(mockApi.save(next));
    showToast("เริ่มข้อมูลสาธิตใหม่แล้ว");
  }
  return (
    <DemoContext.Provider
      value={{
        state,
        user,
        switchUser: setUserId,
        run,
        reset,
        toast,
        showToast,
        persistent,
        mode: 'demo',
        logout: async () => {},
        manageAccess: async()=>{},
        hasPassword:false,
        setPassword:async()=>{},
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function DemoProvider({children}:{children:ReactNode}) {
 return import.meta.env.VITE_APP_MODE==='demo'?<PrototypeProvider>{children}</PrototypeProvider>:<ServerProvider>{children}</ServerProvider>;
}
function ServerProvider({children}:{children:ReactNode}) {
 const authRoute=useSyncExternalStore(subscribeAuth,getAuthRoute);
 const [session,setSession]=useState<Session|null>(null);
 const [config,setConfig]=useState<PublicConfig|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [connectionIssue,setConnectionIssue]=useState('');
 const [toast,showToast]=useState('');
 const [signingIn,setSigningIn]=useState(false);
 const mounted=useRef(true),generation=useRef(0),sessionRef=useRef<Session|null>(null);
 function update(value:Session|null){sessionRef.current=value;setSession(value);}
 async function load() {
  setLoading(true);setError('');
  try {
   const [publicConfig,current]=await Promise.all([request<PublicConfig>('/config'),request<Session>('/session').catch(e=>{if(e instanceof ApiError&&e.status===401)return null;throw e;})]);
   if(!mounted.current)return;
   setConfig(publicConfig);update(current);
  }catch(e){if(mounted.current)setError((e as Error).message);}
  finally{if(mounted.current)setLoading(false);}
 }
 useEffect(()=>{
  mounted.current=true;void load();
  return ()=>{mounted.current=false;};
 },[]);
 useEffect(()=>{
  if(!toast)return;const timer=setTimeout(()=>showToast(''),6000);return()=>clearTimeout(timer);
 },[toast]);
 async function refresh() {
  if(!sessionRef.current)return;
  const version=++generation.current;
  try {
   const current=await request<Session>('/session');
   if(mounted.current&&version===generation.current){update(current);setConnectionIssue('');}
  }catch(e){
   if(!mounted.current||version!==generation.current)return;
   if(e instanceof ApiError&&e.status===401)update(null);
   else setConnectionIssue('ข้อมูลอาจยังไม่ล่าสุด เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง');
  }
 }
 useEffect(()=>{
  if(!session)return;
  const timer=setInterval(()=>{void refresh();},15000);
  const focus=()=>{void refresh();};window.addEventListener('focus',focus);
  return()=>{clearInterval(timer);window.removeEventListener('focus',focus);};
 },[session?.user.id]);
 async function run(command:Command,message='บันทึกสำเร็จ') {
  const current=sessionRef.current;if(!current)throw new Error('กรุณาเข้าสู่ระบบ');
  const version=++generation.current;
  try {
   const state=await sendCommand(command,current.csrfToken);
   if(mounted.current&&version===generation.current)update({...current,user:state.users.find(u=>u.id===current.user.id)??current.user,state});
   if(message)showToast(message);setConnectionIssue('');
  }catch(e){if(e instanceof ApiError&&e.status===401)update(null);else void refresh();throw e;}
 }
 async function logout(){if(!sessionRef.current)return;await request('/auth/logout',{method:'POST',headers:{'x-csrf-token':sessionRef.current.csrfToken}});generation.current++;update(null);}
 async function manageAccess(userId:number,role:User['role'],roomIds:number[],active:boolean) {
  const current=sessionRef.current;if(!current)throw new Error('กรุณาเข้าสู่ระบบ');
  const version=++generation.current;
  const state=await request<AppState>('/admin/access',{method:'POST',headers:{'x-csrf-token':current.csrfToken},body:JSON.stringify({userId,role,roomIds,active})});
  if(version===generation.current)update({...current,state});showToast('บันทึกสิทธิ์แล้ว');
 }
 async function developmentLogin(userId:number) {
  setSigningIn(true);setError('');
  try{update(await request<Session>('/auth/development',{method:'POST',body:JSON.stringify({userId})}));}
  catch(e){setError((e as Error).message);}finally{setSigningIn(false);}
 }
 async function setPassword(password:string,currentPassword?:string) {
  const current=sessionRef.current;if(!current)throw new Error('กรุณาเข้าสู่ระบบ');
  const next=await request<Session>('/auth/password/set',{method:'POST',headers:{'x-csrf-token':current.csrfToken},body:JSON.stringify({password,...(currentPassword?{currentPassword}:{})})});
  generation.current++;update(next);
 }
 if(loading||!session||['verify-email','reset-password'].includes(authRoute))return <main className="session-page"><div className="session-content">
  <Brand/>
  <h1>{loading?'กำลังเปิดระบบ…':'จองห้องสำหรับการเรียนรู้'}</h1>
  <p>ค้นหาห้องว่าง ส่งคำขอจอง และติดตามผลได้ในที่เดียว</p>
  {error?<p className="session-error" role="alert">{error}</p>:null}
  {!loading&&new URLSearchParams(location.search).has('login_error')?<p className="session-error" role="alert">เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง หากเคยสมัครด้วยรหัสผ่าน ให้ใช้รหัสผ่านของบัญชีเดิม</p>:null}
  {!loading&&config?<><PasswordLogin config={config} route={authRoute} onLogin={update}/>
   {config.devLogin?<details className="session-development"><summary>บัญชีทดสอบบนเครื่อง</summary><p>ใช้ตรวจการทำงานกับเซิร์ฟเวอร์และข้อมูลตัวอย่าง ส่วนนี้ปิดในระบบจริง</p>{[[1,'ผู้จอง'],[2,'เจ้าหน้าที่'],[3,'ผู้ดูแลระบบ']].map(([id,label])=><button key={id} className="btn ghost" disabled={signingIn} onClick={()=>void developmentLogin(Number(id))}>{label}</button>)}</details>:null}</>:null}
  {!loading&&error?<button className="btn ghost" onClick={()=>void load()}><RefreshCw size={17}/>ลองเชื่อมต่ออีกครั้ง</button>:null}
 </div></main>;
 return <DemoContext.Provider value={{state:session.state,user:session.user,run,toast,showToast,persistent:true,mode:'server',logout,manageAccess,hasPassword:Boolean(session.hasPassword),setPassword,switchUser:()=>{throw new Error('ไม่รองรับการสลับบัญชีในระบบจริง');},reset:()=>{throw new Error('ไม่สามารถรีเซ็ตข้อมูลจริง');}}}>
  {connectionIssue?<div className="connection-banner" role="status">{connectionIssue}<button onClick={()=>void refresh()}>ลองอีกครั้ง</button></div>:null}
  {children}
 </DemoContext.Provider>;
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider is required");
  return context;
}
