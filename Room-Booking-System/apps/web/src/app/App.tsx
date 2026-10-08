import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  DoorOpen,
  GraduationCap,
  Grid2X2,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useDemo } from "./DemoProvider";
import { canManage, roleLabels, thaiDate, time } from "../lib/domain";
import { ActionDialog } from "../components/ActionDialog";
import { Empty, type DialogAction } from "../components/ui";
import { Rooms } from "../features/Rooms";
import { Bookings } from "../features/Bookings";
import {
  Equipment,
  Locations,
  ManageRooms,
  Penalties,
} from "../features/Administration";
import { Reports } from "../features/Reports";
import { Help, Notifications, Profile } from "../features/HelpProfile";
import { UserAccess } from '../features/UserAccess';
import { Brand } from '../components/Brand';

const items = [
  {id:'access',label:'บัญชีและสิทธิ์',icon:UserRound,roles:['ADMIN'],group:'บริหารพื้นที่'},
  {
    id: "rooms",
    label: "ค้นหาและจองห้อง",
    icon: Grid2X2,
    roles: ["USER", "STAFF", "ADMIN"],
    group: "พื้นที่ของคุณ",
  },
  {
    id: "bookings",
    label: "การจองของฉัน",
    icon: CalendarCheck,
    roles: ["USER", "STAFF", "ADMIN"],
    group: "พื้นที่ของคุณ",
  },
  {
    id: "approvals",
    label: "พิจารณาคำขอ",
    icon: ShieldCheck,
    roles: ["STAFF", "ADMIN"],
    group: "บริหารพื้นที่",
  },
  {
    id: "manage-rooms",
    label: "จัดการห้อง",
    icon: DoorOpen,
    roles: ["STAFF", "ADMIN"],
    group: "บริหารพื้นที่",
  },
  {
    id: "locations",
    label: "อาคารและชั้น",
    icon: Building2,
    roles: ["ADMIN"],
    group: "บริหารพื้นที่",
  },
  {
    id: "equipment",
    label: "อุปกรณ์ส่วนกลาง",
    icon: Package,
    roles: ["ADMIN"],
    group: "บริหารพื้นที่",
  },
  {
    id: "penalties",
    label: "พิจารณาบทลงโทษ",
    icon: ShieldCheck,
    roles: ["ADMIN"],
    group: "บริหารพื้นที่",
  },
  {
    id: "reports",
    label: "รายงานการใช้งาน",
    icon: BarChart3,
    roles: ["STAFF", "ADMIN"],
    group: "บริหารพื้นที่",
  },
  {
    id: "notifications",
    label: "การแจ้งเตือน",
    icon: Bell,
    roles: ["USER", "STAFF", "ADMIN"],
    group: "ข้อมูลและความช่วยเหลือ",
  },
  {
    id: "help",
    label: "คำแนะนำและช่วยเหลือ",
    icon: BookOpen,
    roles: ["USER", "STAFF", "ADMIN"],
    group: "ข้อมูลและความช่วยเหลือ",
  },
  {
    id: "profile",
    label: "ข้อมูลส่วนตัว",
    icon: UserRound,
    roles: ["USER", "STAFF", "ADMIN"],
    group: "ข้อมูลและความช่วยเหลือ",
  },
];
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const mobileQuery = window.matchMedia("(max-width: 700px)");
const subscribeMobile = (cb: () => void) => {
  mobileQuery.addEventListener("change", cb);
  return () => mobileQuery.removeEventListener("change", cb);
};
const getMobile = () => mobileQuery.matches;
const getRoute = () => window.location.hash.replace(/^#\/?/, "") || "rooms";
export function App() {
  const { state, user, switchUser, toast, showToast, persistent, mode, logout } = useDemo();
  const route = useSyncExternalStore(subscribe, getRoute);
  const mobile = useSyncExternalStore(subscribeMobile, getMobile);
  const [action, setAction] = useState<DialogAction | null>(null);
  const [menu, setMenu] = useState(false);
  const [loggedIn, setLoggedIn] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu || !mobile) return;
    sidebarRef.current
      ?.querySelector<HTMLButtonElement>(".mobile-only")
      ?.focus();
    return () => {
      document
        .querySelector<HTMLButtonElement>(".breadcrumb .mobile-only")
        ?.focus();
    };
  }, [menu, mobile]);
  useEffect(() => {
    setAction(null);
    setMenu(false);
    window.scrollTo({ top: 0 });
  }, [route, user.id]);
  const allowed = items.filter((i) => i.roles.includes(user.role) && (i.id !== 'access'||mode === 'server'));
  const current = allowed.find((i) => i.id === route);
  const unread = state.notices.filter(
    (n) => n.userId === user.id && (mode === 'demo' ? n.status === 'QUEUED' : !n.readAt),
  ).length;
  if (!loggedIn)
    return (
      <div className="login-page">
        <div className="login-art">
          <Brand />
          <div>
            <span className="eyebrow">SPACE TO LEARN. ROOM TO GROW.</span>
            <h1>
              พื้นที่แห่งการเรียนรู้
              <br />
              เริ่มต้นที่นี่
            </h1>
            <p>
              ค้นหา จอง และใช้พื้นที่ร่วมกัน
              <br />
              ในมหาวิทยาลัยขอนแก่น
            </p>
            <div className="login-blocks">
              <span />
              <span />
              <span />
            </div>
          </div>
          <small>มหาวิทยาลัยขอนแก่น • KKU SPACE</small>
        </div>
        <div className="login-content">
          <span className="badge warm">เว็บต้นแบบ • บัญชีสาธิต</span>
          <h2>ยินดีต้อนรับกลับ</h2>
          <p>เลือกบัญชีเพื่อทดลองใช้งานระบบจองห้อง</p>
          {state.users
            .filter((u) => u.id <= 3)
            .map((u) => (
              <button
                className="login-account"
                key={u.id}
                onClick={() => {
                  switchUser(u.id);
                  setLoggedIn(true);
                  window.location.hash = "#/rooms";
                }}
              >
                <span className="avatar">{u.name[0]}</span>
                <span>
                  <strong>{roleLabels[u.role]}</strong>
                  <small>{u.name}</small>
                </span>
                <ArrowRight size={20} />
              </button>
            ))}
          <div className="info-strip">
            การเข้าสู่ระบบ Google จะเชื่อมในขั้นพัฒนาระบบจริง
          </div>
        </div>
      </div>
    );
  let page;
  switch (current?.id) {
    case 'access': page=<UserAccess/>; break;
    case "rooms":
      page = <Rooms open={setAction} />;
      break;
    case "bookings":
      page = <Bookings open={setAction} />;
      break;
    case "approvals":
      page = <Bookings open={setAction} staff />;
      break;
    case "manage-rooms":
      page = <ManageRooms open={setAction} />;
      break;
    case "locations":
      page = <Locations open={setAction} />;
      break;
    case "equipment":
      page = <Equipment open={setAction} />;
      break;
    case "penalties":
      page = <Penalties open={setAction} />;
      break;
    case "reports":
      page = <Reports />;
      break;
    case "notifications":
      page = <Notifications />;
      break;
    case "help":
      page = <Help />;
      break;
    case "profile":
      page = <Profile key={user.id} />;
      break;
    default:
      page = (
        <>
          <Empty title="หน้านี้ไม่อยู่ในขอบเขตสิทธิ์ของคุณ">
            เลือกเมนูด้านข้าง หรือกลับไปค้นหาห้อง
          </Empty>
          <a className="btn" href="#/rooms">
            กลับไปค้นหาห้อง
          </a>
        </>
      );
  }
  return (
    <div className={`app-shell ${user.role === "USER" ? "student-shell" : ""}`}>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        ข้ามไปเนื้อหา
      </a>
      {menu ? (
        <button
          className="sidebar-backdrop"
          tabIndex={-1}
          aria-label="ปิดเมนู"
          onClick={() => setMenu(false)}
        />
      ) : null}
      <aside
        ref={sidebarRef}
        inert={mobile && !menu}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMenu(false);
        }}
        className={`sidebar ${menu ? "mobile-open" : ""}`}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            aria-label="ปิดเมนู"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="campus-label">
          <GraduationCap size={15} />
          <span>ระบบจองห้อง มข.</span>
        </div>
        <nav aria-label="เมนูหลัก">
          {["พื้นที่ของคุณ", "บริหารพื้นที่", "ข้อมูลและความช่วยเหลือ"].map(
            (group) =>
              allowed.some((i) => i.group === group) ? (
                <div className="nav-group" key={group}>
                  <span className="nav-group-title">{group}</span>
                  {allowed
                    .filter((i) => i.group === group)
                    .map((i) => (
                      <a
                        key={i.id}
                        href={`#/${i.id}`}
                        className={
                          route === i.id ? "nav-item active" : "nav-item"
                        }
                        aria-current={route === i.id ? "page" : undefined}
                      >
                        <i.icon size={19} />
                        <span>{i.label}</span>
                        {i.id === "approvals" ? (
                          <b>
                            {
                              state.bookings.filter(
                                (b) =>
                                  b.status === "PENDING" &&
                                  canManage(state, user, b.roomId),
                              ).length
                            }
                          </b>
                        ) : null}
                        {i.id === "notifications" && unread ? (
                          <b>{unread}</b>
                        ) : null}
                      </a>
                    ))}
                </div>
              ) : null,
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-reminder">
            <CalendarCheck size={20} />
            <strong>จองแล้ว อย่าลืมเช็คอิน</strong>
            <p>
              ภายใน 30 นาทีหลังเวลาเริ่ม
              <br />
              ที่หน้าการจองของฉัน
            </p>
          </div>
        </div>
      </aside>
      <div className="workspace" inert={mobile && menu}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="เปิดเมนู"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>พื้นที่มหาวิทยาลัย</span>
            <ChevronRight size={14} />
            <strong>{current?.label ?? "ไม่พบหน้า"}</strong>
          </div>
          <div className="topbar-actions">
            {user.role === "USER" && mode === 'demo' ? (
              <span className="prototype-label">ข้อมูลตัวอย่าง</span>
            ) : null}
            <button
              className="clock-button"
              onClick={() => setAction({ kind: "clock" })}
              title="เปลี่ยนเวลาเดโม"
              hidden={mode !== 'demo'}
            >
              <Clock3 size={16} />
              <span>
                {thaiDate(state.now, true)} <b>{time(state.now)}</b>
              </span>
              <ChevronDown size={12} />
            </button>
            <a
              href="#/notifications"
              className="icon-button notification-button"
              aria-label="เปิดการแจ้งเตือน"
            >
              <Bell size={19} />
              {unread ? <i /> : null}
            </a>
            <div className="topbar-divider" />
            <a className="header-user" href="#/profile">
              <span className="avatar">{user.name[0]}</span>
              <span>
                <strong>{user.name}</strong>
                <small>{roleLabels[user.role]}</small>
              </span>
            </a>
            <button
              className="icon-button logout-button"
              aria-label="ออกจากระบบ"
              onClick={() => mode === 'demo' ? setLoggedIn(false) : void logout().catch(e=>showToast((e as Error).message))}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        {!persistent ? (
          <div className="info-strip warning">
            เบราว์เซอร์ไม่อนุญาตให้บันทึกข้อมูล
            ผลการทดลองจะอยู่จนกว่าจะปิดหรือรีเฟรชหน้านี้
          </div>
        ) : null}
        <main id="main-content" tabIndex={-1}>
          {page}
          <footer className="footer">
            <span>
              KKU SPACE <i>·</i> พื้นที่สำหรับทุกความเป็นไปได้
            </span>
            <span>มหาวิทยาลัยขอนแก่น</span>
          </footer>{" "}
          {mode === 'demo' ? <details className="demo-settings">
            <summary>
              <Settings2 size={16} />
              ตั้งค่าต้นแบบ <span>ข้อมูลจำลอง</span>
            </summary>
            <div className="demo-bar">
              <span>
                <span className="demo-dot" />
                <strong>ต้นแบบสำหรับทดลองใช้งาน</strong>
                <span className="demo-description">
                  ข้อมูลจำลอง ไม่มีการส่งอีเมลจริง
                </span>
              </span>
              <label>
                <Settings2 size={14} />
                ทดลองบทบาท
                <select
                  aria-label="ทดลองบทบาท"
                  value={user.id}
                  onChange={(e) => switchUser(Number(e.target.value))}
                >
                  {state.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {roleLabels[u.role]} · {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="demo-settings-actions">
              <span>
                เวลาในต้นแบบ {thaiDate(state.now, true)} {time(state.now)} น.
              </span>
              <button
                className="btn ghost small"
                onClick={() => setAction({ kind: "clock" })}
              >
                <Clock3 size={16} />
                เวลาและงานสาธิต
              </button>
              <button
                className="btn ghost small"
                onClick={() => setAction({ kind: "reset" })}
              >
                <RotateCcw size={16} />
                เริ่มข้อมูลสาธิตใหม่
              </button>
            </div>
          </details> : null}
        </main>
      </div>
      {action ? (
        <ActionDialog
          key={`${action.kind}-${action.id ?? "new"}`}
          action={action}
          close={() => setAction(null)}
        />
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <CheckIcon />
          <span>{toast}</span>
          <button aria-label="ปิดการแจ้งผล" onClick={() => showToast("")}>
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
function CheckIcon() {
  return <CheckCircle2 className="toast-mark" size={20} />;
}
