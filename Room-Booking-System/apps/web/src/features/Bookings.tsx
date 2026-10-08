import { useState } from "react";
import { StudentBookings } from "./StudentBookings";
import { CalendarCheck, Clock3, DoorOpen, Search } from "lucide-react";
import { useDemo } from "../app/DemoProvider";
import { canManage, ms, statusLabels } from "../lib/domain";
import {
  BookingTable,
  Metric,
  PageHeading,
  type OpenDialog,
} from "../components/ui";

export function Bookings({
  open,
  staff = false,
}: {
  open: OpenDialog;
  staff?: boolean;
}) {
  const { state, user } = useDemo();
  const [status, setStatus] = useState(staff ? "PENDING" : "ALL");
  const [query, setQuery] = useState("");
  if (!staff) return <StudentBookings open={open} />;
  const rows = state.bookings.filter((b) =>
    staff ? canManage(state, user, b.roomId) : b.userId === user.id,
  );
  const filtered = rows
    .filter(
      (b) =>
        (status === "ALL" || b.status === status) &&
        `${b.ref} ${b.purpose} ${state.rooms.find((r) => r.id === b.roomId)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt) || b.id - a.id);
  const overdue = rows.filter(
    (b) =>
      b.status === "PENDING" && ms(state.now) > ms(b.createdAt) + 4 * 3600000,
  ).length;
  return (
    <>
      <PageHeading
        eyebrow={staff ? "APPROVAL WORKSPACE" : "MY BOOKINGS"}
        title={staff ? "พิจารณาคำขอจอง" : "การจองของฉัน"}
        description={
          staff
            ? "ตรวจสอบรายละเอียดและพิจารณาคำขอสำหรับห้องที่คุณดูแล"
            : "ทุกการจองของคุณ พร้อมสำหรับช่วงเวลาดี ๆ ที่กำลังจะมาถึง"
        }
      >
        {!staff ? (
          <a className="btn" href="#/rooms">
            <DoorOpen size={17} />
            ค้นหาห้องใหม่
          </a>
        ) : (
          <span className="badge warm">
            {user.role === "ADMIN" ? "ทุกห้อง" : "เฉพาะห้องที่ได้รับมอบหมาย"}
          </span>
        )}
      </PageHeading>
      <div className="metrics-grid">
        <Metric
          label="รอพิจารณา"
          value={rows.filter((b) => b.status === "PENDING").length}
          note={
            staff
              ? `${overdue} รายการเกินกรอบ 4 ชั่วโมง`
              : "มีได้พร้อมกันสูงสุด 3 รายการ"
          }
          icon={<Clock3 size={21} />}
        />
        <Metric
          label="อนุมัติแล้ว / กำลังใช้"
          value={
            rows.filter((b) => ["APPROVED", "CHECKED_IN"].includes(b.status))
              .length
          }
          note="เช็คอินภายใน 30 นาทีหลังเริ่ม"
          icon={<CalendarCheck size={21} />}
        />
        <Metric
          label="ใช้งานเสร็จแล้ว"
          value={rows.filter((b) => b.status === "COMPLETED").length}
          note="ทุกช่วงเวลาแห่งการเรียนรู้"
          icon={<DoorOpen size={21} />}
        />
      </div>
      {staff && overdue ? (
        <div className="info-strip warning">
          <Clock3 size={18} />
          มี {overdue} รายการเกินกรอบพิจารณา 4 ชั่วโมง กรุณาตรวจสอบคำขอ
        </div>
      ) : !staff ? (
        <div className="info-strip">
          <CalendarCheck size={18} />
          ยกเลิกก่อนเวลาเริ่มอย่างน้อย 2 ชั่วโมง และเช็คอินเมื่อถึงเวลาใช้งาน
        </div>
      ) : null}
      <section className="panel">
        <div className="panel-toolbar">
          <div className="filter-tabs">
            {[
              "ALL",
              "PENDING",
              "APPROVED",
              "CHECKED_IN",
              "COMPLETED",
              "CANCELLED",
              "REJECTED",
              "NO_SHOW",
            ].map((s) => (
              <button
                key={s}
                className={status === s ? "filter-tab selected" : "filter-tab"}
                onClick={() => setStatus(s)}
              >
                {s === "ALL"
                  ? "ทั้งหมด"
                  : statusLabels[s as keyof typeof statusLabels]}
              </button>
            ))}
          </div>
          <label className="inline-search">
            <Search size={16} />
            <input
              aria-label="ค้นหาการจอง"
              value={query}
              placeholder="ค้นหาการจอง"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <BookingTable
          bookings={filtered}
          open={open}
          mode={staff ? "staff" : "own"}
        />
        <div className="table-foot">
          ทั้งหมด {filtered.length} รายการ{" "}
          <span>อัปเดตตามข้อมูลสาธิตปัจจุบัน</span>
        </div>
      </section>
    </>
  );
}
