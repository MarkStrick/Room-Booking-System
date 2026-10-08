import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Users,
  X,
} from "lucide-react";
import type {
  Booking,
  BookingStatus,
  Room,
} from "../../../../packages/contracts/src/index";
import { statusLabels, thaiDate, time } from "../lib/domain";
import { useDemo } from "../app/DemoProvider";

export interface DialogAction {
  kind:
    | "book"
    | "detail"
    | "cancel"
    | "reject"
    | "room"
    | "closure"
    | "inspect"
    | "building"
    | "equipment"
    | "penalty"
    | "clock"
    | "reset";
  id?: number;
  date?: string;
  start?: string;
  end?: string;
  attendees?: number;
}
export type OpenDialog = (action: DialogAction) => void;
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Status({ status }: { status: BookingStatus }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      <span className="status-dot" />
      {statusLabels[status]}
    </span>
  );
}
export function Empty({
  title = "ยังไม่มีรายการ",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <CalendarDays size={32} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{children ?? "รายการใหม่จะแสดงที่นี่เมื่อมีการทำรายการ"}</p>
    </div>
  );
}
export function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <small>{note}</small>
    </div>
  );
}
export function RoomScene({ scene, label }: { scene: number; label?: string }) {
  const uid = useId().replace(/:/g, "");
  const colors = [
    ["#eadccc", "#ead2bd", "#c18760", "#657c67"],
    ["#d9ddd4", "#e9e2d8", "#927e65", "#7c8d7e"],
    ["#e4d9d2", "#efe8e0", "#b27558", "#7e746d"],
    ["#dce2dc", "#d8cab5", "#b69770", "#5c7466"],
    ["#ead6cf", "#dedbcf", "#a87454", "#697e70"],
    ["#e1ddd0", "#e9dac7", "#c4936b", "#8c9b7a"],
  ][scene % 6];
  return (
    <svg
      className="room-scene"
      viewBox="0 0 600 300"
      role="img"
      aria-label={label ?? "ภาพประกอบห้องตัวอย่าง"}
    >
      <defs>
        <linearGradient id={`${uid}wall`} x2="0" y2="1">
          <stop stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
        <linearGradient id={`${uid}glass`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d8e5dc" />
          <stop offset="1" stopColor="#f7f5ee" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill={`url(#${uid}wall)`} />
      <path d="M0 218h600v82H0z" fill={colors[1]} />
      <path
        d="M0 218h600M0 262h600M90 218L35 300M255 218l-20 82M415 218l35 82M550 218l50 82"
        stroke="#8d7a61"
        strokeOpacity=".13"
      />
      <rect x="29" y="25" width="205" height="157" rx="1" fill="#958878" />
      <rect x="35" y="31" width="193" height="145" fill={`url(#${uid}glass)`} />
      <path
        d="M96 31v145m67-145v145M35 105h193"
        stroke="#a79b89"
        strokeWidth="5"
      />
      <path
        d="M37 176v-41q20-76 52-44 22-51 49-10 41-53 69 17l21 77"
        fill={colors[3]}
        opacity=".5"
      />
      <rect x="318" y="39" width="189" height="112" rx="3" fill="#918478" />
      <rect
        x="324"
        y="45"
        width="177"
        height="100"
        fill={scene % 2 ? "#f4f2e9" : "#364742"}
      />
      {scene % 2 ? (
        <g fill="none" stroke="#a73b24" opacity=".3" strokeWidth="3">
          <path d="M346 69h51m-51 14h95m-95 14h63" />
          <rect x="453" y="67" width="27" height="35" />
        </g>
      ) : (
        <g fill="#becac3">
          <rect x="350" y="70" width="71" height="4" rx="2" />
          <rect x="350" y="83" width="115" height="3" rx="1" />
          <rect x="350" y="95" width="94" height="3" rx="1" />
        </g>
      )}
      <path d="M264 0v43m165-43v20" stroke="#7d6e60" strokeWidth="2" />
      <path
        d="M243 42q21-18 42 0v5h-42m164-24q22-18 44 0v5h-44"
        fill="#fbf8e9"
      />
      <ellipse
        cx="323"
        cy="264"
        rx="180"
        ry="19"
        fill="#66513e"
        opacity=".12"
      />
      <g fill={colors[3]} stroke="#45524a" strokeWidth="2">
        <rect x="143" y="172" width="49" height="53" rx="9" />
        <rect x="229" y="164" width="49" height="53" rx="9" />
        <rect x="371" y="165" width="49" height="53" rx="9" />
        <rect x="453" y="174" width="49" height="53" rx="9" />
      </g>
      <path
        d="M157 204v49m25-49v49m63-55v47m22-47v47m118-47v47m23-47v47m60-39v49m25-49v49"
        stroke="#534a40"
        strokeWidth="5"
      />
      <path d="M175 197h273l52 38H129z" fill={colors[2]} />
      <path d="M129 235h371v8H129z" fill="#8d5d40" />
      <path
        d="M149 243v44m330-44v44m-268-44v30m205-30v30"
        stroke="#645044"
        strokeWidth="6"
      />
      <g fill={colors[3]} stroke="#45524a" strokeWidth="2">
        <rect x="193" y="233" width="54" height="46" rx="9" />
        <rect x="376" y="233" width="54" height="46" rx="9" />
      </g>
      <path
        d="M203 277v22m35-22v22m149-22v22m33-22v22"
        stroke="#534a40"
        strokeWidth="5"
      />
      <path
        d="M547 161v87m0-66q-42-39-29-47 29-11 29 47m0-6q38-45 44-29 2 19-44 29m0 27q-36-23-32-8 6 20 32 8"
        fill={colors[3]}
        stroke={colors[3]}
        strokeWidth="3"
      />
      <path d="M529 230h37l-6 36h-25z" fill="#c3a18a" />
      <rect width="600" height="300" fill="#fff" opacity=".04" />
    </svg>
  );
}
export function BookingTable({
  bookings,
  open,
  mode = "own",
}: {
  bookings: Booking[];
  open: OpenDialog;
  mode?: "own" | "staff" | "read";
}) {
  const { state, user, run, showToast } = useDemo();
  async function act(type: "CHECKIN" | "DECIDE", id: number) {
    try {
      await run(
        type === "CHECKIN"
          ? { type, bookingId: id }
          : { type, bookingId: id, approve: true, reason: "" },
        type === "CHECKIN"
          ? "เช็คอินสำเร็จ ขอให้เป็นช่วงเวลาที่ดี"
          : "อนุมัติคำขอแล้ว",
      );
    } catch (e) {
      showToast((e as Error).message);
    }
  }
  if (!bookings.length) return <Empty title="ไม่พบการจองตามเงื่อนไข" />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>การจอง / ห้อง</th>
            <th>วันและเวลา</th>
            {mode !== "own" ? <th>ผู้จอง</th> : null}
            <th>สถานะ</th>
            <th className="text-right">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const r = state.rooms.find((r) => r.id === b.roomId)!;
            return (
              <tr key={b.id}>
                <td>
                  <button
                    className="text-button ref"
                    onClick={() => open({ kind: "detail", id: b.id })}
                  >
                    {b.ref}
                    <ArrowUpRight size={13} />
                  </button>
                  <strong className="table-title">{r.name}</strong>
                  <small>
                    {r.code} • {b.attendees} คน
                  </small>
                </td>
                <td>
                  <strong>{thaiDate(b.start, true)}</strong>
                  <small className="time-text">
                    {time(b.start)}–{time(b.end)} น.
                  </small>
                </td>
                {mode !== "own" ? (
                  <td>{state.users.find((u) => u.id === b.userId)?.name}</td>
                ) : null}
                <td>
                  <Status status={b.status} />
                </td>
                <td>
                  <div className="table-actions">
                    {mode === "staff" && b.status === "PENDING" ? (
                      <>
                        <button
                          className="btn small"
                          onClick={() => act("DECIDE", b.id)}
                        >
                          อนุมัติ
                        </button>
                        <button
                          className="btn ghost small"
                          onClick={() => open({ kind: "reject", id: b.id })}
                        >
                          ไม่อนุมัติ
                        </button>
                      </>
                    ) : null}
                    {mode === "own" &&
                    b.userId === user.id &&
                    b.status === "APPROVED" ? (
                      <button
                        className="btn small"
                        onClick={() => act("CHECKIN", b.id)}
                      >
                        เช็คอิน
                      </button>
                    ) : null}
                    {mode === "own" &&
                    ["PENDING", "APPROVED"].includes(b.status) ? (
                      <button
                        className="btn ghost small"
                        onClick={() => open({ kind: "cancel", id: b.id })}
                      >
                        ยกเลิก
                      </button>
                    ) : null}
                    <button
                      className="icon-button"
                      aria-label={`รายละเอียด ${b.ref}`}
                      onClick={() => open({ kind: "detail", id: b.id })}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function RoomLocation({ room }: { room: Room }) {
  const { state } = useDemo();
  return (
    <span className="room-location">
      <MapPin size={13} />
      {state.buildings.find((b) => b.id === room.buildingId)?.name} • ชั้น{" "}
      {room.floor}
    </span>
  );
}
export function RoomFacts({ room }: { room: Room }) {
  return (
    <div className="room-facts">
      <span>
        <Users size={15} />
        รองรับสูงสุด {room.capacity} คน
      </span>
      <span>
        <Building2 size={15} />
        {room.type}
      </span>
    </div>
  );
}
export function Schedule({ start, end }: { start: string; end: string }) {
  return (
    <div className="schedule">
      <span>
        <CalendarDays size={17} />
        {thaiDate(start, true)}
      </span>
      <span>
        <Clock3 size={17} />
        {time(start)}–{time(end)} น.
      </span>
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  close,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  close: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className ?? ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            className="icon-button"
            aria-label="ปิดหน้าต่าง"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
