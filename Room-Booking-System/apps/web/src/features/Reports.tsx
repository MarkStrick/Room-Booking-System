import { useState } from "react";
import { BarChart3, CalendarCheck, Download, Timer, Users } from "lucide-react";
import { useDemo } from "../app/DemoProvider";
import {
  canManage,
  dateOf,
  ms,
  statusLabels,
  thaiDate,
  time,
} from "../lib/domain";
import { Empty, Metric, PageHeading } from "../components/ui";
export function Reports() {
  const { state, user, showToast } = useDemo();
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-23");
  const [building, setBuilding] = useState("");
  const rooms = state.rooms.filter(
    (r) =>
      canManage(state, user, r.id) &&
      (!building || r.buildingId === Number(building)),
  );
  const rows = state.bookings.filter(
    (b) =>
      rooms.some((r) => r.id === b.roomId) &&
      dateOf(b.start) >= from &&
      dateOf(b.start) <= to,
  );
  const used = rows.filter((b) =>
    ["CHECKED_IN", "COMPLETED"].includes(b.status),
  );
  const hours = used.reduce(
    (n, b) => n + (ms(b.end) - ms(b.checkedInAt ?? b.start)) / 3600000,
    0,
  );
  const noShows = rows.filter((b) => b.status === "NO_SHOW").length;
  const due = rows.filter(
    (b) =>
      (b.status === "NO_SHOW" ||
        b.status === "COMPLETED" ||
        b.status === "CHECKED_IN") &&
      ms(b.start) < ms(state.now),
  ).length;
  function exportCsv() {
    const safe = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+@-]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const data = [
      [
        "รหัส",
        "ห้อง",
        "ผู้จอง",
        "วันที่",
        "เริ่ม",
        "สิ้นสุด",
        "สถานะ",
        "จำนวนคน",
      ],
      ...rows.map((b) => [
        b.ref,
        state.rooms.find((r) => r.id === b.roomId)?.name,
        state.users.find((u) => u.id === b.userId)?.name,
        thaiDate(b.start, true),
        time(b.start),
        time(b.end),
        statusLabels[b.status],
        b.attendees,
      ]),
    ];
    const blob = new Blob(
      ["\uFEFF" + data.map((r) => r.map(safe).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kku-bookings-${from}-${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("ส่งออกข้อมูลตามช่วงและอาคารที่เลือกแล้ว");
  }
  return (
    <>
      <PageHeading
        eyebrow="SPACE INSIGHTS"
        title="รายงานการใช้งาน"
        description="เข้าใจการใช้พื้นที่ ผ่านข้อมูลการจองและการเข้าใช้จริง"
      >
        <button
          className="btn"
          disabled={!rows.length || from > to}
          onClick={exportCsv}
        >
          <Download size={17} />
          ส่งออก CSV
        </button>
      </PageHeading>
      <section className="panel report-filters">
        <label>
          ตั้งแต่
          <input
            aria-label="รายงานตั้งแต่"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          ถึงวันที่
          <input
            aria-label="รายงานถึงวันที่"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          อาคาร
          <select
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
          >
            <option value="">ทุกอาคารในขอบเขต</option>
            {state.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <span className="badge green">
          <BarChart3 size={14} />
          อัปเดตจากข้อมูลปัจจุบัน
        </span>
      </section>
      {from > to ? (
        <p className="form-error">วันที่สิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น</p>
      ) : null}
      <div className="metrics-grid four">
        <Metric
          label="คำขอจองทั้งหมด"
          value={rows.length}
          note="ทุกสถานะในช่วงที่เลือก"
          icon={<CalendarCheck size={20} />}
        />
        <Metric
          label="เข้าใช้งานแล้ว"
          value={used.length}
          note="เช็คอินหรือใช้งานเสร็จ"
          icon={<Users size={20} />}
        />
        <Metric
          label="ชั่วโมงใช้โดยประมาณ"
          value={hours.toFixed(1)}
          note="นับจากเช็คอินถึงสิ้นสุดรอบ"
          icon={<Timer size={20} />}
        />
        <Metric
          label="อัตราไม่เข้าใช้"
          value={`${due ? Math.round((noShows / due) * 100) : 0}%`}
          note={`${noShows} จาก ${due} รอบที่มีผลเข้าใช้`}
          icon={<BarChart3 size={20} />}
        />
      </div>
      <div className="report-grid">
        <section className="panel chart-panel">
          <div className="section-heading">
            <h2>จำนวนคำขอต่อห้อง</h2>
            <span className="subtle">ทุกสถานะ</span>
          </div>
          {rooms.length ? (
            rooms.map((r) => {
              const n = rows.filter((b) => b.roomId === r.id).length;
              const max = Math.max(
                1,
                ...rooms.map(
                  (x) => rows.filter((b) => b.roomId === x.id).length,
                ),
              );
              return (
                <div className="bar-row" key={r.id}>
                  <div>
                    <strong>{r.name}</strong>
                    <small>{r.code}</small>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                  <strong>{n}</strong>
                </div>
              );
            })
          ) : (
            <Empty />
          )}
        </section>
        <section className="panel chart-panel">
          <div className="section-heading">
            <h2>สถานะการจอง</h2>
          </div>
          <div
            className="donut"
            style={{
              background: `conic-gradient(var(--primary) 0 ${rows.length ? (used.length / rows.length) * 100 : 0}%, var(--gold) 0 ${rows.length ? ((used.length + rows.filter((b) => b.status === "PENDING").length) / rows.length) * 100 : 0}%, #e6e0d8 0 100%)`,
            }}
          >
            <div>
              <strong>{rows.length}</strong>
              <span>รายการทั้งหมด</span>
            </div>
          </div>
          <div className="legend">
            <span>
              <i style={{ background: "var(--primary)" }} />
              เข้าใช้งานแล้ว <strong>{used.length}</strong>
            </span>
            <span>
              <i style={{ background: "var(--gold)" }} />
              รออนุมัติ{" "}
              <strong>
                {rows.filter((b) => b.status === "PENDING").length}
              </strong>
            </span>
            <span>
              <i style={{ background: "#e6e0d8" }} />
              สถานะอื่น{" "}
              <strong>
                {rows.length -
                  used.length -
                  rows.filter((b) => b.status === "PENDING").length}
              </strong>
            </span>
          </div>
        </section>
      </div>
      <div className="info-strip">
        <Timer size={18} />
        ชั่วโมงใช้เป็นค่าประมาณจากเวลาเช็คอินถึงเวลาสิ้นสุด
        ไม่ใช่เวลาที่วัดจากการออกห้องจริง
      </div>
    </>
  );
}
