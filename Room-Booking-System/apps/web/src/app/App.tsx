import { HolidayPosterNotice } from "../components/HolidayPosterNotice";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
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
  MessageCircle,
  Search,
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
import { UserAccess } from "../features/UserAccess";
import { Brand } from "../components/Brand";

const items = [
  {
    id: "access",
    label: "บัญชีและสิทธิ์",
    icon: UserRound,
    roles: ["ADMIN"],
    group: "บริหารพื้นที่",
  },
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
  const {
    state,
    user,
    switchUser,
    toast,
    showToast,
    persistent,
    mode,
    logout,
    canTest,
  } = useDemo();
  const route = useSyncExternalStore(subscribe, getRoute);
  const mobile = useSyncExternalStore(subscribeMobile, getMobile);
  const [action, setAction] = useState<DialogAction | null>(null);
  const [menu, setMenu] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

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
    setAccountOpen(false);
    window.scrollTo({ top: 0 });
  }, [route, user.id]);
  useEffect(() => {
    if (!accountOpen) return;
    function dismiss(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node))
        setAccountOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [accountOpen]);
  const allowed = items.filter(
    (i) =>
      i.roles.includes(user.role) && (i.id !== "access" || mode === "server"),
  );
  const current = allowed.find((i) => i.id === route);
  const unread = state.notices.filter(
    (n) =>
      n.userId === user.id &&
      (mode === "demo" ? n.status === "QUEUED" : !n.readAt),
  ).length;
  const mobileItems =
    user.role === "USER"
      ? [
          { id: "rooms", label: "ค้นหา", icon: Search },
          { id: "bookings", label: "การจอง", icon: CalendarCheck },
          { id: "help", label: "ผู้ช่วย", icon: MessageCircle },
        ]
      : [
          { id: "approvals", label: "อนุมัติ", icon: ShieldCheck },
          { id: "rooms", label: "ค้นหา", icon: Search },
          { id: "help", label: "ผู้ช่วย", icon: MessageCircle },
        ];
  let page;
  switch (current?.id) {
    case "access":
      page = <UserAccess />;
      break;
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
    <div
      className={`app-shell integrated-shell ${user.role === "USER" ? "student-shell" : ""}`}
    >
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
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setMenu(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMenu(false);
          if (event.key === "Tab" && mobile && menu) {
            const controls = sidebarRef.current?.querySelectorAll<HTMLElement>(
              "a[href], button:not([disabled])",
            );
            const first = controls?.[0],
              last = controls?.[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
        className={`sidebar ${menu ? "mobile-open" : ""}`}
        id="workspace-navigation"
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
          <div className="workspace-brand">
            <Brand />
            <div className="desktop-workspace-title">
              <GraduationCap size={22} />
              <span>
                <small>มหาวิทยาลัยขอนแก่น</small>
                <strong>{current?.label ?? "พื้นที่มหาวิทยาลัย"}</strong>
              </span>
            </div>
            <span className="workspace-brand-description">
              ระบบจองห้อง มหาวิทยาลัยขอนแก่น
            </span>
          </div>
          <div className="topbar-actions">
            {user.role === "USER" && mode === "demo" ? (
              <span className="prototype-label">ข้อมูลตัวอย่าง</span>
            ) : null}
            <button
              className="clock-button"
              onClick={() => setAction({ kind: "clock" })}
              title="เปลี่ยนเวลาเดโม"
              hidden={mode !== "demo" || !canTest}
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
              aria-label={
                unread
                  ? `เปิดการแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน`
                  : "เปิดการแจ้งเตือน"
              }
            >
              <Bell size={19} />
              {unread ? (
                <span className="notification-count">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </a>
            <div
              className="account-menu"
              ref={accountRef}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setAccountOpen(false);
                  accountButtonRef.current?.focus();
                }
              }}
            >
              <button
                ref={accountButtonRef}
                className="header-user account-trigger"
                aria-label="เปิดเมนูบัญชี"
                aria-expanded={accountOpen}
                aria-controls="account-options"
                onClick={() => setAccountOpen((value) => !value)}
              >
                <span className="avatar">{user.name[0]}</span>
                <span className="account-name">
                  <strong>{user.name}</strong>
                  <small>{roleLabels[user.role]}</small>
                </span>
                <ChevronDown size={16} />
              </button>
              {accountOpen ? (
                <div id="account-options" className="account-options">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                  <a href="#/profile" onClick={() => setAccountOpen(false)}>
                    <UserRound size={18} />
                    ข้อมูลส่วนตัว
                  </a>
                  <button
                    onClick={() =>
                      void logout().catch((e) =>
                        showToast((e as Error).message, 'error'),
                      )
                    }
                  >
                    <LogOut size={18} />
                    ออกจากระบบ
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="เปิดเมนู"
              aria-expanded={menu}
              aria-controls="workspace-navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <Grid2X2 size={16} />
            <span>พื้นที่มหาวิทยาลัย</span>
            <ChevronRight size={14} />
            <strong>{current?.label ?? "ไม่พบหน้า"}</strong>
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
          {mode === "demo" && canTest ? (
            <details className="demo-settings">
              <summary>
                <Settings2 size={16} />
                เครื่องมือทดสอบ <span>เฉพาะผู้ดูแลระบบ</span>
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
            </details>
          ) : null}
        </main>
      </div>
      <nav
        className="mobile-bottom-nav"
        aria-label="เมนูด่วน"
        inert={mobile && menu}
      >
        {mobileItems.map((item) => (
          <a
            key={item.id}
            href={`#/${item.id}`}
            className={route === item.id ? "active" : ""}
            aria-current={route === item.id ? "page" : undefined}
          >
            <item.icon size={22} />
            <span>{item.label}</span>
          </a>
        ))}
        <button
          aria-label="เปิดเมนูทั้งหมด"
          aria-expanded={menu}
          aria-controls="workspace-navigation"
          className={
            !mobileItems.some((item) => item.id === route) ? "active" : ""
          }
          onClick={() => setMenu(true)}
        >
          <Menu size={22} />
          <span>เมนู</span>
        </button>
      </nav>
      {route === "rooms" && <HolidayPosterNotice />}
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
