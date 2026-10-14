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
import { reportData, encodeCsv } from "../../../../packages/core/src/reporting";
export function Reports() {
  const { state, user, showToast, run } = useDemo();
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState("");
  const [reportPage,setReportPage]=useState(0);
  const savedReports=state.reports??[];
  const lastPage=Math.max(0,Math.ceil(savedReports.length/30)-1);
  const currentPage=Math.min(reportPage,lastPage);
  const [from, setFrom] = useState(() => dateOf(state.now).slice(0, 7) + "-01");
  const [to, setTo] = useState(() => dateOf(state.now));
  const [building, setBuilding] = useState("");
  const rooms = state.rooms.filter(
    (r) =>
      canManage(state, user, r.id) &&
      (!building || r.buildingId === Number(building)),
  );
  const report = reportData(state, rooms, from, to);
  const rows = report.rows;
  const used = rows.filter((b) =>
    ["CHECKED_IN", "COMPLETED"].includes(b.status),
  );
  const hours = report.hours;
  const noShows = rows.filter((b) => b.status === "NO_SHOW").length;
  const due = rows.filter(
    (b) =>
      (b.status === "NO_SHOW" ||
        b.status === "COMPLETED" ||
        b.status === "CHECKED_IN") &&
      ms(b.start) < ms(state.now),
  ).length;
  function exportCsv() {
    const data = [
      [
        "รหัส",
        "ห้อง",
        "ผู้จอง",
        "วันที่เริ่ม",
        "เริ่ม",
        "วันที่สิ้นสุด",
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
        thaiDate(b.end, true),
        time(b.end),
        statusLabels[b.status],
        b.attendees,
      ]),
    ];
    const blob = new Blob([encodeCsv(data)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kku-bookings-${from}-${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("ส่งออกข้อมูลตามช่วงและอาคารที่เลือกแล้ว");
  }
  async function saveReport(){
    if(saving)return;
    setSaving(true);setSaveError("");
    try{await run({type:'REPORT_SAVE',from,to,buildingId:building?Number(building):undefined},'บันทึกรายงานแล้ว');setReportPage(0);}
    catch(error){setSaveError((error as Error).message);}
    finally{setSaving(false);}
  }
  return (
    <>
      <PageHeading
        eyebrow="SPACE INSIGHTS"
        title="รายงานการใช้งาน"
        description="เข้าใจการใช้พื้นที่ ผ่านข้อมูลการจองและการเข้าใช้จริง"
      >
        <button className="btn" disabled={saving||!report.valid||!rooms.length} onClick={()=>void saveReport()}>
          {saving?'กำลังบันทึก…':'บันทึกรายงาน'}
        </button>
        <button
          className="btn"
          disabled={!rows.length || !report.valid}
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
      {saveError?<p className="form-error" role="alert">{saveError}</p>:null}
      <section className="panel" aria-label="รายงานที่บันทึกไว้">
        <div className="section-heading"><h2>รายงานที่บันทึกไว้</h2><span className="subtle">ยอด ณ เวลาบันทึก</span></div>
        {(state.reports??[]).length?<div className="table-scroll"><table>
          <thead><tr><th>เลขที่</th><th>ช่วงวันที่</th><th>คำขอ</th><th>ชั่วโมง</th><th>ยกเลิก</th><th>บันทึกเมื่อ</th></tr></thead>
          <tbody>{savedReports.slice(currentPage*30,(currentPage+1)*30).map(r=><tr key={r.id}><td>R-{r.id}</td><td>{thaiDate(r.from,true)} – {thaiDate(r.to,true)}</td><td>{r.totalBookings}</td><td>{r.totalHours.toFixed(2)}</td><td>{r.canceledCount}</td><td>{thaiDate(r.createdAt,true)} {time(r.createdAt)}</td></tr>)}</tbody>
        </table></div>:<Empty title="ยังไม่มีรายงานที่บันทึก">เลือกช่วงวันที่และอาคาร แล้วกดบันทึกรายงานเพื่อเก็บยอดสำหรับตรวจสอบย้อนหลัง</Empty>}
        {savedReports.length>30?<div className="table-actions" aria-label="หน้ารายงานย้อนหลัง"><button className="btn ghost small" disabled={currentPage===0} onClick={()=>setReportPage(currentPage-1)}>ก่อนหน้า</button><span>หน้า {currentPage+1} / {lastPage+1}</span><button className="btn ghost small" disabled={currentPage===lastPage} onClick={()=>setReportPage(currentPage+1)}>ถัดไป</button></div>:null}
      </section>
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
          label="ชั่วโมงที่เข้าใช้แล้ว"
          value={hours.toFixed(1)}
          note="ถึงเวลาปัจจุบัน ไม่เกินเวลาจบรอบ"
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
        ชั่วโมงนับจากเช็คอินถึงเวลาปัจจุบันหรือสิ้นสุดรอบตามเวลาใดถึงก่อน
        ไม่ใช่เวลาที่วัดจากการออกห้องจริง อัตราใช้ห้องเทียบเวลาทำการที่ตั้งไว้
        หักวันหยุดและช่วงปิดห้อง
      </div>
      {!report.valid ? (
        <p className="form-error" role="alert">
          กรุณาเลือกช่วงวันที่ไม่เกิน 366 วัน และวันสิ้นสุดไม่ก่อนวันเริ่ม
        </p>
      ) : null}
      <section className="panel spaced">
        <div className="section-heading">
          <h2>อัตราการใช้ห้อง</h2>
          <span>
            SLA ตัดสินทันเวลา {report.slaOnTime}/{report.slaTotal} รายการ
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>เวลาทำการที่ผ่านไป (ชม.)</th>
                <th>ใช้ในเวลาทำการ (ชม.)</th>
                <th>อัตราใช้</th>
              </tr>
            </thead>
            <tbody>
              {report.utilization.map((x) => (
                <tr key={x.room.id}>
                  <td>{x.room.name}</td>
                  <td>{x.openHours?.toFixed(1) ?? "ยังไม่ตั้งเวลาทำการ"}</td>
                  <td>{x.usedHours?.toFixed(1) ?? "—"}</td>
                  <td>{x.rate === null ? "—" : x.rate.toFixed(1) + "%"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel spaced">
        <div className="section-heading">
          <h2>สภาพอุปกรณ์ประจำห้อง</h2>
          <button
            className="btn ghost"
            disabled={!report.valid || !report.assets.length}
            onClick={() => {
              const data = [
                [
                  "ห้อง",
                  "อุปกรณ์",
                  "จำนวน",
                  "ชำรุด",
                  "ตรวจล่าสุด",
                  "แหล่งข้อมูล",
                ],
                ...report.assets.map((a) => [
                  a.room.name,
                  a.name,
                  a.total,
                  a.damaged,
                  a.inspectedAt ?? "",
                  a.source,
                ]),
              ];
              const url = URL.createObjectURL(
                new Blob([encodeCsv(data)], { type: "text/csv;charset=utf-8" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = `kku-assets-${from}-${to}.csv`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            ส่งออกอุปกรณ์ CSV
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>อุปกรณ์</th>
                <th>ทั้งหมด</th>
                <th>ชำรุด</th>
                <th>ผลตรวจล่าสุด ณ วันสิ้นสุด</th>
              </tr>
            </thead>
            <tbody>
              {report.assets.map((a) => (
                <tr key={`${a.room.id}-${a.id}`}>
                  <td>{a.room.name}</td>
                  <td>{a.name}</td>
                  <td>{a.total}</td>
                  <td>{a.damaged}</td>
                  <td>
                    {a.inspectedAt
                      ? thaiDate(a.inspectedAt, true)
                      : "ยังไม่มีผลตรวจ"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!report.assets.length ? (
          <Empty title="ยังไม่มีข้อมูลอุปกรณ์ประจำห้อง" />
        ) : null}
      </section>
    </>
  );
}
