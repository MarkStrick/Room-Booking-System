import { playSound, type SoundEffect } from '../lib/sound-effects';
import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  AppState,
  Command,
  User,
} from "../../../../packages/contracts/src/index";
import {
  ApiError,
  request,
  sendCommand,
  type PublicConfig,
  type Session,
} from "../lib/api";
import { LoginScreen } from '../reference/screens/LoginScreen';
import { LandingPage } from '../features/LandingPage';
import { AppSkeleton } from '../components/AppSkeleton';
import type { AssistantRequest, AssistantResponse } from '../../../../packages/contracts/src/assistant';

interface DemoContextValue {
  state: AppState;
  user: User;
  switchUser: (id: number) => void;
  run: (command: Command, message?: string) => Promise<void>;
  reset: () => void;
  toast: string;
  showToast: (message: string, sound?: SoundEffect) => void;
  persistent: boolean;
  mode: "demo" | "server";
  logout: () => Promise<void>;
  manageAccess: (
    userId: number,
    role: User["role"],
    roomIds: number[],
    active: boolean,
    start?: string,
    end?: string,
  ) => Promise<void>;
  refresh: (manual?: boolean) => Promise<void>;
  canTest: boolean;
  openSandbox: () => Promise<void>;
  askAssistant?: (input: AssistantRequest, signal?: AbortSignal) => Promise<AssistantResponse>;
}
export const DemoContext = createContext<DemoContextValue | null>(null);
const subscribeHash=(cb:()=>void)=>{window.addEventListener('hashchange',cb);return ()=>window.removeEventListener('hashchange',cb);};
const currentHash=()=>location.hash;
const AdminSandbox = lazy(() => import("./AdminSandbox"));
const AUTO_REFRESH_MS = 60_000;
export function DemoProvider({ children }: { children: ReactNode }) {
  return <ServerProvider>{children}</ServerProvider>;
}
function ServerProvider({ children }: { children: ReactNode }) {
  const hash=useSyncExternalStore(subscribeHash,currentHash);
  const [catalog,setCatalog]=useState<AppState|null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectionIssue, setConnectionIssue] = useState("");
  const [toast, setToast] = useState("");
  function showToast(message: string, sound: SoundEffect = 'notification') {
    if (message) playSound(sound);
    setToast(message);
  }
  const [sandbox, setSandbox] = useState(false);
  const mounted = useRef(true),
    generation = useRef(0),
    pendingWrites = useRef(0),
    sessionRef = useRef<Session | null>(null);
  const refreshPending = useRef<Promise<void> | null>(null);
  const refreshAbort = useRef<AbortController | null>(null);
  const logoutPending = useRef<Promise<void> | null>(null);
  const loadAbort = useRef<AbortController | null>(null);
  const lastUpdatedAt = useRef(0);
  function update(value: Session | null) {
    if (value) lastUpdatedAt.current = Date.now();
    if (value?.user.role !== "ADMIN") setSandbox(false);
    sessionRef.current = value;
    setSession(value);
  }
  async function load() {
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    const version = ++generation.current;
    const options = { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]) };
    setLoading(true);
    setError("");
    try {
      const [publicConfig, current] = await Promise.all([
        request<PublicConfig>("/config", options),
        request<Session>("/session", options).catch((e) => {
          if (e instanceof ApiError && e.status === 401) return null;
          throw e;
        }),
      ]);
      if (!mounted.current || version !== generation.current) return;
      setConfig(publicConfig);
      update(current);
      if(!current) {
        const publicCatalog = await request<AppState>("/public/catalog", options);
        if (mounted.current && version === generation.current) {
          setCatalog(publicCatalog);
          lastUpdatedAt.current = Date.now();
        }
      }
    } catch (e) {
      if (mounted.current && version === generation.current && !controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (mounted.current && version === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      loadAbort.current?.abort();
      refreshAbort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => showToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  function refresh(manual = false): Promise<void> {
    if (logoutPending.current) return Promise.resolve();
    if (refreshPending.current) return refreshPending.current;
    const pending = refreshData(manual).finally(() => { refreshPending.current = null; });
    refreshPending.current = pending;
    return pending;
  }
  async function refreshData(manual = false) {
    // A focus/poll refresh must not supersede an in-flight command response.
    if(pendingWrites.current>0) {
      if (manual) showToast('กำลังบันทึกรายการ กรุณารอสักครู่แล้วรีเฟรชอีกครั้ง');
      return;
    }
    const version = ++generation.current;
    const controller = new AbortController();
    refreshAbort.current = controller;
    const options = { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]) };
    if (!sessionRef.current) {
      try {
        const catalog = await request<AppState>("/public/catalog", options);
        if (!mounted.current || version !== generation.current) return;
        setCatalog(catalog);
        lastUpdatedAt.current = Date.now();
        if (manual) showToast('อัปเดตข้อมูลล่าสุดแล้ว', 'success');
      }
      catch(e){if (mounted.current && version === generation.current && !controller.signal.aborted && manual) showToast((e as Error).message, 'error');}
      return;
    }
    try {
      const current = await request<Session>("/session", options);
      if (mounted.current && version === generation.current) {
        update(current);
        setConnectionIssue("");
        if (manual) showToast('อัปเดตข้อมูลล่าสุดแล้ว', 'success');
      }
    } catch (e) {
      if (!mounted.current || version !== generation.current || controller.signal.aborted) return;
      if (e instanceof ApiError && e.status === 401) {
        update(null);
        if (manual) showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง', 'error');
      } else {
        if (manual) showToast('อัปเดตข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง', 'error');
        setConnectionIssue(
          "ข้อมูลอาจยังไม่ล่าสุด เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง",
        );
      }
    }
  }
  useEffect(() => {
    if (!session && !catalog) return;
    const focus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastUpdatedAt.current >= AUTO_REFRESH_MS) void refresh();
    };
    const timer = setInterval(focus, AUTO_REFRESH_MS);
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [session?.user.id, Boolean(catalog)]);
  async function run(command: Command, message = "บันทึกสำเร็จ") {
    const current = sessionRef.current;
    if (!current) throw new Error("กรุณาเข้าสู่ระบบ");
    const version = ++generation.current;
    pendingWrites.current++;
    let recover=false;
    try {
      const state = await sendCommand(command, current.csrfToken);
      if (mounted.current && version === generation.current)
        update({
          ...current,
          user:
            state.users.find((u) => u.id === current.user.id) ?? current.user,
          state,
        });
      if (message) { playSound('success'); showToast(message); }
      setConnectionIssue("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) update(null);
      else recover=true;
      throw e;
    } finally {
      pendingWrites.current--;
      if(recover&&pendingWrites.current===0)void refresh();
    }
  }
  function logout(): Promise<void> {
    if (logoutPending.current) return logoutPending.current;
    const current = sessionRef.current;
    if (!current) return Promise.resolve();
    ++generation.current;
    refreshAbort.current?.abort();
    loadAbort.current?.abort();
    const pending = request("/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": current.csrfToken },
    }).then(() => {
      update(null);
      setCatalog(null);
      setConnectionIssue("");
      location.hash = "#/login";
    }).finally(() => { logoutPending.current = null; });
    logoutPending.current = pending;
    return pending;
  }
  async function askAssistant(input: AssistantRequest, signal?: AbortSignal) {
    const current = sessionRef.current;
    if (!current) throw new Error('กรุณาเข้าสู่ระบบก่อนถามผู้ช่วย');
    try {
      const result = await request<AssistantResponse>('/assistant', {
        method: 'POST', headers: { 'x-csrf-token': current.csrfToken }, body: JSON.stringify(input),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : undefined,
      });
      if (sessionRef.current?.user.id !== current.user.id) throw new Error('บัญชีเปลี่ยนระหว่างทำรายการ กรุณาลองใหม่');
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) update(null);
      throw error;
    }
  }
  async function manageAccess(
    userId: number,
    role: User["role"],
    roomIds: number[],
    active: boolean,
    start?: string,
    end?: string,
  ) {
    const current = sessionRef.current;
    if (!current) throw new Error("กรุณาเข้าสู่ระบบ");
    const version = ++generation.current;
    const state = await request<AppState>("/admin/access", {
      method: "POST",
      headers: { "x-csrf-token": current.csrfToken },
      body: JSON.stringify({ userId, role, roomIds, active, start, end }),
    });
    if (version === generation.current) update({ ...current, state });
    playSound('success'); showToast("บันทึกสิทธิ์แล้ว");
  }
  async function openSandbox() {
    if (sessionRef.current?.user.role !== "ADMIN")
      throw new Error("เฉพาะผู้ดูแลระบบ");
    await request("/admin/test-tools");
    setSandbox(true);
    location.hash = "#/rooms";
  }
  if (loading) {
    return <AppSkeleton variant={!hash || hash === '#/home' ? 'home' : hash === '#/login' ? 'login' : 'workspace'} />;
  }
  if ((!hash || hash === '#/home') && !new URLSearchParams(location.search).has('login_error')) {
    return <LandingPage signedIn={Boolean(session)} />;
  }
  if(!loading && !session && catalog && hash!=='#/login' && !new URLSearchParams(location.search).has('login_error')) {
    const login=()=>{location.hash='#/login';};
    const unavailable=async()=>{login();throw new Error('กรุณาเข้าสู่ระบบก่อนทำรายการ');};
    return <DemoContext.Provider value={{state:catalog,user:{id:0,name:'ผู้เยี่ยมชม',email:'',phone:'',affiliation:'',role:'USER',active:false},run:unavailable,toast,showToast,persistent:true,mode:'server',logout:async()=>login(),manageAccess:unavailable,refresh,canTest:false,openSandbox:unavailable,switchUser:login,reset:login}}>{children}</DemoContext.Provider>;
  }
  if (loading || !session) {
    const loginError=new URLSearchParams(location.search).get('login_error');
    const domains=config?.allowedDomains??[];
    return <LoginScreen loading={loading} googleReady={Boolean(config?.googleReady)} allowedDomains={domains} error={error || (!loading && loginError ? loginError==='domain' ? `กรุณาใช้บัญชี Google ${domains.map(domain=>`@${domain}`).join(' หรือ ') || 'ของมหาวิทยาลัยที่ได้รับอนุญาต'}` : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ' : '')} retry={() => void load()} />;
  }
  if (sandbox && session.user.role === "ADMIN")
    return (
      <Suspense
        fallback={<AppSkeleton />}
      >
        <AdminSandbox
          onExit={() => {
            setSandbox(false);
            location.hash = "#/help";
          }}
        >
          {children}
        </AdminSandbox>
      </Suspense>
    );
  return (
    <DemoContext.Provider
      value={{
        state: session.state,
        user: session.user,
        run,
        toast,
        showToast,
        persistent: true,
        mode: "server",
        logout,
        manageAccess,
        refresh,
        canTest: session.user.role === "ADMIN",
        openSandbox,
        askAssistant,
        switchUser: () => {
          throw new Error("ไม่รองรับการสลับบัญชีในระบบจริง");
        },
        reset: () => {
          throw new Error("ไม่สามารถรีเซ็ตข้อมูลจริง");
        },
      }}
    >
      {connectionIssue ? (
        <div className="connection-banner" role="status">
          {connectionIssue}
          <button onClick={() => void refresh()}>ลองอีกครั้ง</button>
        </div>
      ) : null}
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider is required");
  return context;
}
