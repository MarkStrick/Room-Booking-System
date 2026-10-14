import { useState } from "react";
import {
  Building2,
  ClipboardCheck,
  DoorOpen,
  Package,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { FloorManager } from "./FloorManager";
import { useDemo } from "../app/DemoProvider";
import { RoomCover } from "../components/RoomCover";
import { EquipmentHandovers } from "./OperationsControls";
import {
  canManage,
  dateOf,
  suspended,
  thaiDate,
  time,
  violationCount,
} from "../lib/domain";
import {
  Empty,
  Metric,
  PageHeading,
  RoomLocation,
  type OpenDialog,
} from "../components/ui";

export function ManageRooms({ open }: { open: OpenDialog }) {
  const { state, user } = useDemo();
  const rooms = state.rooms.filter((r) => canManage(state, user, r.id));
  return (
    <>
      <PageHeading
        eyebrow="ROOM DIRECTORY"
        title="จัดการห้องและความพร้อม"
        description="ดูแลพื้นที่ อุปกรณ์ประจำห้อง และบันทึกผลตรวจประจำวัน"
      >
        {user.role === "ADMIN" ? (
          <button className="btn" onClick={() => open({ kind: "room" })}>
            <Plus size={17} />
            เพิ่มห้อง
          </button>
        ) : null}
      </PageHeading>
      <p className="info-strip">
        ยังไม่ตรวจวันนี้{" "}
        {
          rooms.filter(
            (r) =>
              r.active !== false &&
              !state.inspections.some(
                (i) => i.roomId === r.id && dateOf(i.at) === dateOf(state.now),
              ),
          ).length
        }{" "}
        ห้อง
      </p>
      <div className="admin-room-grid">
        {rooms.map((r) => {
          const inspection = state.inspections.find((i) => i.roomId === r.id);
          return (
            <article className="admin-room panel" key={r.id}>
              <RoomCover room={r} />
              <div className="admin-room-body">
                <div className="row-between">
                  <span className="eyebrow">{r.code}</span>
                  <span
                    className={`badge ${r.status === "AVAILABLE" ? "green" : "warm"}`}
                  >
                    {r.active === false
                      ? "เลิกใช้งาน"
                      : r.status === "AVAILABLE"
                        ? "พร้อมใช้งาน"
                        : r.status === "MAINTENANCE"
                          ? "ปิดปรับปรุง"
                          : "ปิดให้บริการ"}
                  </span>
                </div>
                <h3>{r.name}</h3>
                <RoomLocation room={r} />
                <p className="subtle">
                  {r.capacity} ที่นั่ง • {r.amenities.join(" · ")}
                </p>
                <div className="inspection-note">
                  <ClipboardCheck size={16} />
                  {inspection
                    ? `ตรวจล่าสุด ${thaiDate(inspection.at, true)} • ${inspection.condition}`
                    : "ยังไม่มีผลตรวจสภาพ"}
                </div>
                <div className="admin-card-actions">
                  <button
                    className="btn ghost small"
                    onClick={() => open({ kind: "inspect", id: r.id })}
                  >
                    บันทึกผลตรวจ
                  </button>
                  {user.role === "ADMIN" ? (
                    <>
                      <button
                        className="btn ghost small"
                        onClick={() => open({ kind: "room", id: r.id })}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() => open({ kind: "closure", id: r.id })}
                      >
                        ปิดชั่วคราว
                      </button>
                      <button
                        className="btn ghost small"
                        onClick={() =>
                          open({
                            kind: "room-active",
                            id: r.id,
                            active: r.active === false,
                          })
                        }
                      >
                        {r.active === false ? "เปิดใช้งาน" : "เลิกใช้งาน"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <section className="panel spaced">
        <div className="section-heading">
          <h2>ช่วงเวลาปิดห้อง</h2>
          <span className="subtle">
            การปิดจากผู้ดูแลไม่เพิ่มความผิดให้ผู้จอง
          </span>
        </div>
        {state.closures.filter((c) => canManage(state, user, c.roomId))
          .length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ห้อง</th>
                  <th>เริ่ม</th>
                  <th>สิ้นสุด</th>
                  <th>เหตุผล</th>
                </tr>
              </thead>
              <tbody>
                {state.closures
                  .filter((c) => canManage(state, user, c.roomId))
                  .map((c) => (
                    <tr key={c.id}>
                      <td>
                        {state.rooms.find((r) => r.id === c.roomId)?.name}
                      </td>
                      <td>
                        {thaiDate(c.start, true)} {time(c.start)}
                      </td>
                      <td>
                        {thaiDate(c.end, true)} {time(c.end)}
                      </td>
                      <td>{c.reason}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="ยังไม่มีช่วงปิดห้องชั่วคราว" />
        )}
      </section>
      <section className="panel spaced">
        <div className="section-heading">
          <h2>ประวัติตรวจความพร้อม</h2>
        </div>
        {state.inspections.filter((i) => canManage(state, user, i.roomId))
          .length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ห้อง</th>
                  <th>เวลา</th>
                  <th>สภาพ</th>
                  <th>หมายเหตุ</th>
                  <th>ผู้ตรวจ</th>
                </tr>
              </thead>
              <tbody>
                {state.inspections
                  .filter((i) => canManage(state, user, i.roomId))
                  .map((i) => (
                    <tr key={i.id}>
                      <td>
                        {state.rooms.find((r) => r.id === i.roomId)?.name}
                      </td>
                      <td>
                        {thaiDate(i.at, true)} {time(i.at)}
                      </td>
                      <td>{i.condition}</td>
                      <td>{i.note || "—"}</td>
                      <td>
                        {state.users.find((u) => u.id === i.actorId)?.name}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="เริ่มบันทึกผลตรวจห้องในวันนี้" />
        )}
      </section>
      <EquipmentHandovers />
    </>
  );
}
export function Locations({ open }: { open: OpenDialog }) {
  const { state } = useDemo();
  return (
    <>
      <PageHeading
        eyebrow="CAMPUS LOCATIONS"
        title="อาคารและชั้น"
        description="โครงสร้างพื้นที่สำหรับเชื่อมต่อห้องทั่วมหาวิทยาลัย"
      >
        <button className="btn" onClick={() => open({ kind: "building" })}>
          <Plus size={17} />
          เพิ่มอาคาร
        </button>
      </PageHeading>
      <div className="location-grid">
        {state.buildings.map((b) => (
          <article className="panel location-card" key={b.id}>
            <span className="large-icon">
              <Building2 size={30} />
            </span>
            <h2>{b.name}</h2>
            <p>
              {b.floors} ชั้น •{" "}
              {state.rooms.filter((r) => r.buildingId === b.id).length} ห้อง
            </p>
            <FloorManager building={b}/>
            <button
              className="btn ghost"
              onClick={() => open({ kind: "building", id: b.id })}
            >
              แก้ไขข้อมูลอาคาร
            </button>
            <div className="holiday-actions">
              <button
                className="btn ghost"
                onClick={() =>
                  open({
                    kind: "building-active",
                    id: b.id,
                    active: b.active === false,
                  })
                }
              >
                {b.active === false ? "เปิดใช้งาน" : "เลิกใช้งาน"}
              </button>
            </div>
            {b.active === false ? (
              <p className="badge warm">อาคารเลิกใช้งาน</p>
            ) : null}
          </article>
        ))}
      </div>
      <section className="panel spaced holiday-panel">
        <div className="section-heading">
          <h2>วันหยุดมหาวิทยาลัย</h2>
          <button className="btn" onClick={() => open({ kind: "holiday" })}>
            <Plus size={17} />
            เพิ่มวันหยุด
          </button>
        </div>
        {state.holidays.length === 0 ? (
          <p className="subtle">
            ยังไม่มีวันหยุด เพิ่มวันที่มหาวิทยาลัยไม่เปิดให้จองห้องได้ที่นี่
          </p>
        ) : null}
        {[...state.holidays].sort().map((d) => (
          <div className="list-row holiday-row" key={d}>
            <strong>{thaiDate(`${d}T12:00:00+07:00`)}</strong>
            <span className="badge warm">ไม่เปิดรับการจอง{state.settings?.holidayPosters?.[d] ? " · มีโปสเตอร์" : ""}</span>
            <div className="holiday-actions">
              <button
                className="btn ghost"
                aria-label={`แก้ไขวันหยุด ${thaiDate(`${d}T12:00:00+07:00`)}`}
                onClick={() => open({ kind: "holiday", date: d })}
              >
                แก้ไข
              </button>
              <button
                className="btn ghost"
                aria-label={`ลบวันหยุด ${thaiDate(`${d}T12:00:00+07:00`)}`}
                onClick={() => open({ kind: "holiday-delete", date: d })}
              >
                ลบ
              </button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
export function Equipment({ open }: { open: OpenDialog }) {
  const { state,run,showToast } = useDemo();
  const [changing,setChanging]=useState<number|null>(null);
  return (
    <>
      <PageHeading
        eyebrow="EQUIPMENT INVENTORY"
        title="อุปกรณ์ส่วนกลาง"
        description="ติดตามจำนวนอุปกรณ์เพิ่มเติมที่พร้อมสำหรับการจอง"
      >
        <button className="btn" onClick={() => open({ kind: "equipment" })}>
          <Plus size={17} />
          เพิ่มอุปกรณ์
        </button>
      </PageHeading>
      <div className="metrics-grid">
        <Metric
          label="ประเภทอุปกรณ์"
          value={state.equipment.length}
          note="อุปกรณ์กองกลางสำหรับยืม"
          icon={<Package size={21} />}
        />
        <Metric
          label="จำนวนทั้งหมด"
          value={state.equipment.reduce((n, e) => n + e.total, 0)}
          note="หน่วยในกองกลาง"
          icon={<DoorOpen size={21} />}
        />
        <Metric
          label="จำนวนที่ถูกกันไว้"
          value={state.equipment.reduce((n, e) => n + e.total - e.remaining, 0)}
          note="ตามคำขอที่ยังไม่ปิดรายการ"
          icon={<ClipboardCheck size={21} />}
        />
      </div>
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>อุปกรณ์</th>
                <th>ทั้งหมด</th>
                <th>พร้อมจอง</th>
                <th>ถูกกันไว้</th>
                <th>สัดส่วนที่พร้อม</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.equipment.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.name}</strong>
                    <small>EQ-{String(e.id).padStart(3, "0")}</small>
                  </td>
                  <td>{e.total}</td>
                  <td>
                    <span className="badge green">{e.remaining} ชิ้น</span>
                  </td>
                  <td>{e.total - e.remaining}</td>
                  <td>
                    <div className="progress-track">
                      <span
                        style={{
                          width: `${e.total ? (e.remaining / e.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn ghost small"
                      onClick={() => open({ kind: "equipment", id: e.id })}
                    >
                      แก้ไข
                    </button>
                    <button className="btn ghost small" disabled={changing!==null||(e.active!==false&&e.total!==e.remaining)} onClick={async()=>{
                      setChanging(e.id);
                      try{await run({type:'EQUIPMENT_ACTIVE',equipmentId:e.id,active:e.active===false},e.active===false?'เปิดใช้งานอุปกรณ์แล้ว':'เลิกใช้งานอุปกรณ์แล้ว');}
                      catch(error){showToast((error as Error).message, 'error');}finally{setChanging(null);}
                    }}>{changing===e.id?'กำลังบันทึก…':e.active===false?'เปิดใช้งาน':'เลิกใช้งาน'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="info-strip">
        <Package size={18} />
        อุปกรณ์ประจำห้องแสดงในรายละเอียดห้อง และไม่ถูกหักจากกองกลางนี้
      </div>
      <EquipmentHandovers />
    </>
  );
}
export function Penalties({ open }: { open: OpenDialog }) {
  const { state } = useDemo();
  const candidates = state.users.filter(
    (u) => violationCount(state, u.id) >= 3,
  );
  return (
    <>
      <PageHeading
        eyebrow="FAIR USE & REVIEW"
        title="พิจารณาบทลงโทษ"
        description="ตรวจหลักฐานก่อนตัดสิน ตักเตือนหรือระงับสิทธิ์ตามช่วงวันที่กำหนด"
      />
      <div className="metrics-grid">
        <Metric
          label="ผู้ใช้ถึงเกณฑ์"
          value={candidates.length}
          note="ความผิดสะสมตั้งแต่ 3 ครั้ง"
          icon={<ShieldCheck size={21} />}
        />
        <Metric
          label="ระงับสิทธิ์อยู่"
          value={state.users.filter((u) => suspended(state, u.id)).length}
          note="ตามวันที่ปัจจุบันของระบบ"
          icon={<ClockIcon />}
        />
        <Metric
          label="การตัดสินทั้งหมด"
          value={state.penalties.length}
          note="ตักเตือนและระงับสิทธิ์"
          icon={<ClipboardCheck size={21} />}
        />
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>ผู้ใช้ที่ต้องพิจารณา</h2>
          <span className="badge warm">เกณฑ์ 3 ครั้ง</span>
        </div>
        {candidates.length ? (
          candidates.map((u) => (
            <div className="candidate" key={u.id}>
              <div className="avatar">{u.name[0]}</div>
              <div className="candidate-info">
                <strong>{u.name}</strong>
                <small>{u.email}</small>
                <div className="violation-list">
                  {state.violations
                    .filter((v) => v.userId === u.id)
                    .map((v) => (
                      <span key={v.id}>
                        {thaiDate(v.at, true)} •{" "}
                        {v.type === "NO_SHOW" ? "ไม่ได้เช็คอิน" : "ยกเลิกช้า"}
                      </span>
                    ))}
                </div>
              </div>
              <strong className="violation-count">
                {violationCount(state, u.id)}
                <small>ครั้ง</small>
              </strong>
              <button
                className="btn small"
                disabled={suspended(state, u.id)}
                onClick={() => open({ kind: "penalty", id: u.id })}
              >
                {suspended(state, u.id) ? "ระงับสิทธิ์อยู่" : "พิจารณา"}
              </button>
            </div>
          ))
        ) : (
          <Empty title="ไม่มีผู้ใช้รอพิจารณา" />
        )}
      </section>
      <section className="panel spaced">
        <div className="section-heading">
          <h2>ประวัติการตัดสิน</h2>
        </div>
        {state.penalties.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ผู้ใช้</th>
                  <th>ผลการพิจารณา</th>
                  <th>ช่วงวันที่</th>
                  <th>เหตุผล</th>
                </tr>
              </thead>
              <tbody>
                {state.penalties.map((p) => (
                  <tr key={p.id}>
                    <td>{state.users.find((u) => u.id === p.userId)?.name}</td>
                    <td>
                      <span
                        className={`badge ${p.type === "WARNING" ? "warm" : "red"}`}
                      >
                        {p.type === "WARNING" ? "ตักเตือน" : "ระงับสิทธิ์"}
                      </span>
                    </td>
                    <td>
                      {p.type === "WARNING"
                        ? thaiDate(p.at, true)
                        : `${thaiDate(`${p.start}T12:00:00+07:00`, true)} – ${thaiDate(`${p.end}T12:00:00+07:00`, true)}`}
                      <small>
                        {p.type === "SUSPENSION" && p.end < dateOf(state.now)
                          ? "พ้นกำหนดแล้ว"
                          : ""}
                      </small>
                    </td>
                    <td>{p.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="ยังไม่มีผลการพิจารณา" />
        )}
      </section>
    </>
  );
}
function ClockIcon() {
  return <ShieldCheck size={21} />;
}
