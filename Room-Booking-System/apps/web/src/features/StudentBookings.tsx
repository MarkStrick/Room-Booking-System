import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Clock3,
  DoorOpen,
  Users,
} from "lucide-react";
import { useDemo } from "../app/DemoProvider";
import { activeStatuses, ms, suspended, thaiDate, time } from "../lib/domain";
import { RoomLocation, Status, type OpenDialog } from "../components/ui";

export function StudentBookings({ open }: { open: OpenDialog }) {
  const { state, user, run } = useDemo();
  const [tab, setTab] = useState("current");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const own = state.bookings.filter((b) => b.userId === user.id);
  const current = own.filter((b) => activeStatuses.includes(b.status));
  const rows = own
    .filter(
      (b) =>
        tab === "all" ||
        (tab === "current"
          ? activeStatuses.includes(b.status)
          : !activeStatuses.includes(b.status)),
    )
    .sort((a, b) =>
      tab === "current" ? ms(a.start) - ms(b.start) : ms(b.start) - ms(a.start),
    );
  async function checkIn(id: number) {
    setBusyId(id);
    setError("");
    try {
      await run({ type: "CHECKIN", bookingId: id }, "เช็คอินสำเร็จ");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }
  return (
    <div className="student-bookings">
      <div className="student-page-heading booking-page-heading">
        <div>
          <h1>การจองของฉัน</h1>
          <p>ติดตามผลอนุมัติ และเช็คอินเมื่อถึงเวลาใช้ห้อง</p>
        </div>
        <a className="btn ghost" href="#/rooms">
          <DoorOpen size={18} />
          ค้นหาห้อง
        </a>
      </div>
      {current.some((b) => b.status === "APPROVED") ? (
        <p className="student-checkin-reminder">
          <CalendarCheck size={20} />
          <span>อนุมัติแล้ว อย่าลืมเช็คอินภายใน 30 นาทีหลังเวลาเริ่ม</span>
        </p>
      ) : null}
      <div className="student-booking-tabs" aria-label="กรองรายการจอง">
        {[
          ["current", "รายการปัจจุบัน"],
          ["history", "ประวัติการจอง"],
          ["all", "ทั้งหมด"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            className={tab === key ? "selected" : ""}
            onClick={() => setTab(key)}
          >
            {label}
            {key === "current" ? <span>{current.length}</span> : null}
          </button>
        ))}
      </div>
      {error ? (
        <p className="selection-error" role="alert">
          {error}
        </p>
      ) : null}
      {rows.length ? (
        <div className="student-booking-list">
          {rows.map((b) => {
            const room = state.rooms.find((r) => r.id === b.roomId)!;
            const canCheckIn =
              b.status === "APPROVED" &&
              !suspended(state, user.id) &&
              ms(state.now) >= ms(b.start) &&
              ms(state.now) <= ms(b.start) + 1800000 &&
              ms(state.now) < ms(b.end);
            const canCancel =
              ["PENDING", "APPROVED"].includes(b.status) &&
              ms(b.start) - ms(state.now) >= 7200000;
            return (
              <article
                className="student-booking-card"
                key={b.id}
                aria-label={`${b.ref} ${room.name}`}
              >
                <div className="student-booking-card-header">
                  <div>
                    <h2>{room.name}</h2>
                    <RoomLocation room={room} />
                  </div>
                  <Status status={b.status} />
                </div>
                <div className="student-booking-time">
                  <span>
                    <CalendarDays size={18} />
                    {thaiDate(b.start, true)}
                  </span>
                  <span>
                    <Clock3 size={18} />
                    {time(b.start)}–{time(b.end)} น.
                  </span>
                  <span>
                    <Users size={18} />
                    {b.attendees} คน
                  </span>
                </div>
                <p className="student-booking-purpose">{b.purpose}</p>
                <p className="booking-reference">
                  {b.ref}
                  {b.equipment.length
                    ? ` · ยืมอุปกรณ์ ${b.equipment.reduce((n, e) => n + e.qty, 0)} ชิ้น`
                    : ""}
                </p>
                {b.status === "PENDING" ? (
                  <p className="booking-next-step">
                    รอเจ้าหน้าที่พิจารณา ติดตามผลได้ที่หน้านี้
                  </p>
                ) : null}
                {b.status === "APPROVED" && !canCheckIn ? (
                  <p className="booking-next-step">
                    {ms(state.now) < ms(b.start)
                      ? `เช็คอินได้ตั้งแต่ ${thaiDate(b.start, true)} เวลา ${time(b.start)} น.`
                      : suspended(state, user.id)
                        ? "บัญชีอยู่ระหว่างระงับสิทธิ์ ตรวจรายละเอียดในข้อมูลส่วนตัว"
                        : "พ้นช่วงเช็คอินแล้ว กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลห้อง"}
                  </p>
                ) : null}
                {b.status === "CHECKED_IN" ? (
                  <p className="booking-next-step">
                    เช็คอินแล้ว ใช้ห้องได้ถึง {time(b.end)} น.
                  </p>
                ) : null}
                {b.reason ? (
                  <p className="booking-next-step">เหตุผล: {b.reason}</p>
                ) : null}
                <div className="student-booking-actions">
                  <button
                    className="text-button"
                    onClick={() => open({ kind: "detail", id: b.id })}
                  >
                    ดูรายละเอียด
                    <ArrowRight size={16} />
                  </button>
                  <div>
                    {canCancel ? (
                      <button
                        className="btn ghost"
                        onClick={() => open({ kind: "cancel", id: b.id })}
                      >
                        ยกเลิกคำขอ
                      </button>
                    ) : null}
                    {canCheckIn ? (
                      <button
                        className="btn"
                        disabled={busyId === b.id}
                        onClick={() => checkIn(b.id)}
                      >
                        <CalendarCheck size={18} />
                        {busyId === b.id
                          ? "กำลังเช็คอิน…"
                          : "เช็คอินเข้าใช้ห้อง"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {["PENDING", "APPROVED"].includes(b.status) && !canCancel ? (
                  <p className="booking-cancel-hint">
                    ยกเลิกได้ก่อนเวลาเริ่มอย่างน้อย 2 ชั่วโมง
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="student-empty">
          <CalendarDays size={30} />
          <h2>{own.length ? "ไม่มีรายการในหมวดนี้" : "ยังไม่มีการจองห้อง"}</h2>
          <p>
            {own.length
              ? "เลือกดูหมวดอื่น หรือค้นหาห้องสำหรับการจองครั้งต่อไป"
              : "เลือกวัน เวลา และห้อง แล้วส่งคำขอแรกของคุณ"}
          </p>
          <a className="btn" href="#/rooms">
            ค้นหาห้องว่าง
            <ArrowRight size={17} />
          </a>
        </div>
      )}
    </div>
  );
}
