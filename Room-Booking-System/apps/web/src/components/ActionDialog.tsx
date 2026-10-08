import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Package,
  Users,
} from "lucide-react";
import type { Command, Room } from "../../../../packages/contracts/src/index";
import { useDemo } from "../app/DemoProvider";
import {
  addDays,
  dateOf,
  overlaps,
  stamp,
  thaiDate,
  time,
} from "../lib/domain";
import {
  Modal,
  RoomFacts,
  RoomLocation,
  RoomScene,
  Schedule,
  Status,
  type DialogAction,
} from "./ui";

const titles: Record<DialogAction["kind"], string> = {
  book: "ส่งคำขอจองห้อง",
  detail: "รายละเอียดการจอง",
  cancel: "ยืนยันการยกเลิก",
  reject: "ไม่อนุมัติคำขอ",
  room: "ข้อมูลห้อง",
  closure: "ปิดห้องชั่วคราว",
  inspect: "บันทึกผลตรวจห้อง",
  building: "ข้อมูลอาคาร",
  equipment: "อุปกรณ์ส่วนกลาง",
  penalty: "พิจารณาบทลงโทษ",
  clock: "ทดลองเวลาและงานอัตโนมัติ",
  reset: "เริ่มการสาธิตใหม่",
};
export function ActionDialog({
  action,
  close,
}: {
  action: DialogAction;
  close: () => void;
}) {
  const { state, user, run, reset, mode } = useDemo();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [penaltyType, setPenaltyType] = useState("WARNING");
  const booking = state.bookings.find((b) => b.id === action.id);
  const room = state.rooms.find(
    (r) =>
      r.id ===
      (["detail", "cancel", "reject"].includes(action.kind)
        ? booking?.roomId
        : action.id),
  );
  const building = state.buildings.find((b) => b.id === action.id);
  const equipment = state.equipment.find((e) => e.id === action.id);
  const today = dateOf(state.now);
  const [closureStart, setClosureStart] = useState(
    stamp(addDays(today, 1), "09:00"),
  );
  const [closureEnd, setClosureEnd] = useState(
    stamp(addDays(today, 1), "17:00"),
  );
  const affected = state.bookings.filter(
    (b) =>
      b.roomId === room?.id &&
      ["PENDING", "APPROVED", "CHECKED_IN"].includes(b.status) &&
      overlaps(b.start, b.end, closureStart, closureEnd),
  );
  function text(data: FormData, key: string) {
    return String(data.get(key) ?? "");
  }
  function number(data: FormData, key: string) {
    return Number(data.get(key));
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      let c: Command | undefined;
      switch (action.kind) {
        case "book":
          c = {
            type: "BOOK",
            roomId: room!.id,
            start: stamp(action.date!, action.start!),
            end: stamp(action.date!, action.end!),
            purpose: text(data, "purpose"),
            attendees: number(data, "attendees"),
            participants: data.getAll("participants").map(Number),
            equipment: state.equipment
              .map((e) => ({
                id: e.id,
                qty: number(data, `equipment-${e.id}`),
              }))
              .filter((e) => e.qty > 0),
          };
          break;
        case "cancel":
          c = { type: "CANCEL", bookingId: booking!.id };
          break;
        case "reject":
          c = {
            type: "DECIDE",
            bookingId: booking!.id,
            approve: false,
            reason: text(data, "reason"),
          };
          break;
        case "room":
          c = {
            type: "ROOM_SAVE",
            room: {
              id: room?.id,
              name: text(data, "name"),
              code: text(data, "code"),
              buildingId: number(data, "buildingId"),
              floor: number(data, "floor"),
              capacity: number(data, "capacity"),
              type: text(data, "roomType"),
              status: text(data, "roomStatus") as Room["status"],
              reason: text(data, "reason"),
              amenities: data.getAll("amenities").map(String),
              scene: room?.scene ?? state.rooms.length % 6,
            },
          };
          break;
        case "closure":
          c = {
            type: "CLOSE_ROOM",
            roomId: room!.id,
            start: closureStart,
            end: closureEnd,
            reason: text(data, "reason"),
          };
          break;
        case "inspect":
          c = {
            type: "INSPECT",
            roomId: room!.id,
            condition: text(data, "condition"),
            note: text(data, "note"),
          };
          break;
        case "building":
          c = {
            type: "BUILDING_SAVE",
            id: building?.id,
            name: text(data, "name"),
            floors: number(data, "floors"),
          };
          break;
        case "equipment":
          c = {
            type: "EQUIPMENT_SAVE",
            id: equipment?.id,
            name: text(data, "name"),
            total: number(data, "total"),
          };
          break;
        case "penalty":
          c = {
            type: "PENALTY",
            userId: action.id!,
            penaltyType: penaltyType as "WARNING" | "SUSPENSION",
            start: text(data, "start"),
            end: text(data, "end"),
            reason: text(data, "reason"),
          };
          break;
        case "clock":
          await run(
            { type: "CLOCK", now: `${text(data, "now")}:00+07:00` },
            "",
          );
          await run({ type: "RUN_JOBS" }, "ประมวลผลงานสาธิตแล้ว");
          close();
          return;
        case "reset":
          reset();
          close();
          return;
      }
      if (c) {
        await run(c, action.kind === "book" ? "" : "บันทึกสำเร็จ");
        if (action.kind === "book") setSuccess(true);
        else close();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  let content: ReactNode;
  if (action.kind === "detail" && booking && room)
    content = (
      <>
        <div className="detail-scene">
          <RoomScene scene={room.scene} />
        </div>
        <div className="detail-title">
          <div>
            <RoomLocation room={room} />
            <h3>{room.name}</h3>
          </div>
          <Status status={booking.status} />
        </div>
        <Schedule start={booking.start} end={booking.end} />
        <div className="detail-grid">
          <div>
            <small>รหัสอ้างอิง</small>
            <strong>{booking.ref}</strong>
          </div>
          <div>
            <small>ผู้จอง</small>
            <strong>
              {state.users.find((u) => u.id === booking.userId)?.name}
            </strong>
          </div>
          <div>
            <small>วัตถุประสงค์</small>
            <strong>{booking.purpose}</strong>
          </div>
          <div>
            <small>จำนวนผู้เข้าร่วม</small>
            <strong>{booking.attendees} คน</strong>
          </div>
        </div>
        {booking.equipment.length ? (
          <div className="detail-equipment">
            <h4>อุปกรณ์ที่ขอยืม</h4>
            {booking.equipment.map((e) => (
              <p key={e.id}>
                {state.equipment.find((x) => x.id === e.id)?.name}{" "}
                <strong>{e.qty} ชิ้น</strong>
              </p>
            ))}
          </div>
        ) : null}
        {booking.reason ? (
          <div className="info-strip">เหตุผล: {booking.reason}</div>
        ) : null}
        <div className="timeline">
          <h4>ประวัติรายการ</h4>
          {[...state.audit]
            .filter((a) => a.bookingId === booking.id)
            .reverse()
            .map((a) => (
              <div key={a.id}>
                <i />
                <span>
                  {a.text}
                  <small>
                    {thaiDate(a.at, true)} {time(a.at)} •{" "}
                    {a.actorId
                      ? state.users.find((u) => u.id === a.actorId)?.name
                      : "ระบบอัตโนมัติ"}
                  </small>
                </span>
              </div>
            ))}
          {!state.audit.some((a) => a.bookingId === booking.id) ? (
            <p className="subtle">
              สร้างคำขอ {thaiDate(booking.createdAt, true)}{" "}
              {time(booking.createdAt)}
            </p>
          ) : null}
        </div>
        <button className="btn ghost full" onClick={close}>
          ปิดรายละเอียด
        </button>
      </>
    );
  else if (success)
    content = (
      <div className="booking-success" role="status">
        <CheckCircle2 size={40} />
        <h2>ส่งคำขอเรียบร้อยแล้ว</h2>
        <p>
          คำขออยู่ระหว่างรออนุมัติ ยังไม่ใช่การยืนยันใช้ห้อง
          <br />
          ติดตามได้ที่การจองของฉัน
        </p>
        <strong className="booking-success-room">{room?.name}</strong>
        <p className="booking-reference">
          รหัสคำขอ{" "}
          {
            state.bookings.find(
              (b) =>
                b.userId === user.id &&
                b.roomId === room?.id &&
                b.start === stamp(action.date!, action.start!),
            )?.ref
          }
        </p>
        <Schedule
          start={stamp(action.date!, action.start!)}
          end={stamp(action.date!, action.end!)}
        />
        <a className="btn full" href="#/bookings" onClick={close}>
          ดูการจองของฉัน
        </a>
        <button className="btn ghost full" onClick={close}>
          ค้นหาห้องต่อ
        </button>
      </div>
    );
  else
    content = (
      <form onSubmit={submit}>
        {action.kind === "book" && room ? (
          <>
            <div className="booking-room-summary">
              <span className="booking-room-icon">
                <DoorOpen size={24} />
              </span>
              <div>
                <h3>{room.name}</h3>
                <RoomLocation room={room} />
                <small className="booking-reference">{room.code}</small>
              </div>
            </div>
            <Schedule
              start={stamp(action.date!, action.start!)}
              end={stamp(action.date!, action.end!)}
            />
            <RoomFacts room={room} />
            <div className="booking-policy-note">
              <Clock3 size={17} />
              <span>
                เจ้าหน้าที่พิจารณาภายใน 4 ชั่วโมง
                <br />
                ติดตามผลที่การจองของฉัน
              </span>
            </div>
            <div className="booking-essential-fields">
              <label>
                วัตถุประสงค์การใช้งาน
                <textarea
                  name="purpose"
                  placeholder="เช่น ประชุมเตรียมโครงงาน / ทบทวนบทเรียน"
                  rows={3}
                  required
                  maxLength={500}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </label>
              <div className="purpose-shortcuts">
                <span>เลือกข้อความตัวอย่าง</span>
                {["ทบทวนบทเรียน", "ประชุมโครงงาน", "ติวกลุ่ม"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={purpose === p}
                    onClick={() => setPurpose(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <label>
                จำนวนผู้เข้าร่วม
                <input
                  name="attendees"
                  type="number"
                  min={1}
                  max={room.capacity}
                  defaultValue={Math.min(action.attendees ?? 4, room.capacity)}
                  required
                />
              </label>
            </div>
            <details className="booking-options">
              <summary>
                <Package size={17} />
                ยืมอุปกรณ์เพิ่มเติม <span>ไม่บังคับ</span>
              </summary>
              <p>อุปกรณ์ประจำห้องมีให้แล้ว เลือกส่วนนี้เมื่อต้องการยืมเพิ่ม</p>
              <fieldset>
                <legend className="sr-only">อุปกรณ์ที่ขอยืม</legend>
                {state.equipment.map((e) => (
                  <label className="equipment-choice" key={e.id}>
                    <div>
                      <strong>{e.name}</strong>
                      <small>คงเหลือ {e.remaining} ชิ้น</small>
                    </div>
                    <input
                      aria-label={`จำนวน ${e.name}`}
                      name={`equipment-${e.id}`}
                      type="number"
                      min={0}
                      max={e.remaining}
                      defaultValue={0}
                    />
                  </label>
                ))}
              </fieldset>
            </details>
            {mode === 'demo' ? <details className="booking-options">
              <summary>
                <Users size={17} />
                เพิ่มรายชื่อผู้เข้าร่วม <span>ไม่บังคับ</span>
              </summary>
              <fieldset>
                <legend className="sr-only">ผู้เข้าร่วมเพิ่มเติม</legend>
                <div className="participant-choices">
                  {state.users
                    .filter((u) => u.id !== user.id && u.role === "USER")
                    .map((u) => (
                      <label className="checkbox-label" key={u.id}>
                        <input
                          name="participants"
                          value={u.id}
                          type="checkbox"
                        />
                        {u.name}
                      </label>
                    ))}
                </div>
              </fieldset>
            </details> : null}
          </>
        ) : null}
        {action.kind === "cancel" && booking && room ? (
          <>
            <p>
              ต้องการยกเลิก <strong>{booking.ref}</strong> ใช่ไหม?
            </p>
            <h3>{room.name}</h3>
            <Schedule start={booking.start} end={booking.end} />
            <div className="info-strip warning">
              <AlertCircle size={18} />
              ยกเลิกได้เมื่อเหลือเวลาก่อนเริ่มอย่างน้อย 2 ชั่วโมง
            </div>
          </>
        ) : null}
        {action.kind === "reject" ? (
          <>
            <p>
              คำขอ <strong>{booking?.ref}</strong> • {room?.name}
            </p>
            <label>
              เหตุผลที่ไม่อนุมัติ
              <textarea
                name="reason"
                rows={4}
                placeholder="แจ้งเหตุผลให้ผู้จองทราบ"
                required
                maxLength={500}
              />
            </label>
          </>
        ) : null}
        {action.kind === "room" ? (
          <>
            <div className="form-grid">
              <label>
                รหัสห้อง
                <input
                  name="code"
                  defaultValue={room?.code}
                  placeholder="LIB-202"
                  required
                  maxLength={30}
                />
              </label>
              <label>
                ชื่อห้อง
                <input
                  name="name"
                  defaultValue={room?.name}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                อาคาร
                <select
                  name="buildingId"
                  defaultValue={room?.buildingId ?? state.buildings[0].id}
                >
                  {state.buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ชั้น
                <input
                  name="floor"
                  type="number"
                  defaultValue={room?.floor ?? 1}
                  min={1}
                  required
                />
              </label>
              <label>
                ความจุ
                <input
                  name="capacity"
                  type="number"
                  defaultValue={room?.capacity ?? 8}
                  min={1}
                  required
                />
              </label>
              <label>
                ประเภท
                <select
                  name="roomType"
                  defaultValue={room?.type ?? "ห้องศึกษากลุ่ม"}
                >
                  {["ห้องศึกษากลุ่ม", "ห้องประชุม", "ห้องเรียน"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend>อุปกรณ์ประจำห้อง</legend>
              <div className="participant-choices">
                {["Wi-Fi", "โปรเจกเตอร์", "กระดานไวท์บอร์ด", "จอแสดงผล"].map(
                  (a) => (
                    <label className="checkbox-label" key={a}>
                      <input
                        name="amenities"
                        type="checkbox"
                        value={a}
                        defaultChecked={
                          room?.amenities.includes(a) ?? a === "Wi-Fi"
                        }
                      />
                      {a}
                    </label>
                  ),
                )}
              </div>
            </fieldset>
            <label>
              สถานะ
              <select
                name="roomStatus"
                defaultValue={room?.status ?? "AVAILABLE"}
              >
                <option value="AVAILABLE">พร้อมใช้งาน</option>
                <option value="MAINTENANCE">ปิดปรับปรุง</option>
                <option value="CLOSED">ปิดให้บริการ</option>
              </select>
            </label>
            <label>
              เหตุผลการปิด (หากมี)
              <input name="reason" defaultValue={room?.reason} />
            </label>
          </>
        ) : null}
        {action.kind === "closure" ? (
          <>
            <h3>{room?.name}</h3>
            <label>
              เริ่มปิด
              <input
                type="datetime-local"
                value={closureStart.slice(0, 16)}
                onChange={(e) => setClosureStart(`${e.target.value}:00+07:00`)}
                required
              />
            </label>
            <label>
              สิ้นสุด
              <input
                type="datetime-local"
                value={closureEnd.slice(0, 16)}
                onChange={(e) => setClosureEnd(`${e.target.value}:00+07:00`)}
                required
              />
            </label>
            <label>
              เหตุผล
              <textarea
                name="reason"
                required
                rows={3}
                placeholder="เช่น ซ่อมระบบปรับอากาศ"
              />
            </label>
            <div className="closure-preview">
              <strong>มีการจองได้รับผลกระทบ {affected.length} รายการ</strong>
              {affected.map((b) => (
                <p key={b.id}>
                  {b.ref} • {state.users.find((u) => u.id === b.userId)?.name}{" "}
                  <Status status={b.status} />
                </p>
              ))}
              <small>
                รายการที่ได้รับผลกระทบจะถูกยกเลิกและสร้างการแจ้งเตือน
                โดยไม่เพิ่มความผิดให้ผู้จอง
              </small>
            </div>
          </>
        ) : null}
        {action.kind === "inspect" ? (
          <>
            <h3>{room?.name}</h3>
            <label>
              ความพร้อม
              <select name="condition">
                <option>พร้อมใช้งาน</option>
                <option>พบอุปกรณ์ชำรุด</option>
                <option>ต้องทำความสะอาด</option>
                <option>ต้องซ่อมบำรุง</option>
              </select>
            </label>
            <label>
              รายละเอียดผลตรวจ
              <textarea
                name="note"
                rows={4}
                placeholder="ระบุอุปกรณ์หรือจุดที่ต้องดูแล"
                maxLength={1000}
              />
            </label>
            <div className="info-strip compact">
              ผู้ตรวจ {user.name} • {thaiDate(state.now, true)}
            </div>
          </>
        ) : null}
        {action.kind === "building" ? (
          <>
            <label>
              ชื่ออาคาร
              <input name="name" defaultValue={building?.name} required />
            </label>
            <label>
              จำนวนชั้น
              <input
                name="floors"
                type="number"
                min={1}
                max={100}
                defaultValue={building?.floors ?? 1}
                required
              />
            </label>
          </>
        ) : null}
        {action.kind === "equipment" ? (
          <>
            <label>
              ชื่ออุปกรณ์
              <input name="name" defaultValue={equipment?.name} required />
            </label>
            <label>
              จำนวนทั้งหมดในกองกลาง
              <input
                name="total"
                type="number"
                min={equipment ? equipment.total - equipment.remaining : 0}
                defaultValue={equipment?.total ?? 1}
                required
              />
            </label>
            <div className="info-strip compact">
              จำนวนคงเหลือคำนวณหลังหักรายการที่ถูกกันไว้
            </div>
          </>
        ) : null}
        {action.kind === "penalty" ? (
          <>
            <h3>{state.users.find((u) => u.id === action.id)?.name}</h3>
            <label>
              ผลการพิจารณา
              <select
                value={penaltyType}
                onChange={(e) => setPenaltyType(e.target.value)}
              >
                <option value="WARNING">ตักเตือน (ยังจองได้)</option>
                <option value="SUSPENSION">ระงับสิทธิ์ตามช่วงวันที่</option>
              </select>
            </label>
            {penaltyType === "SUSPENSION" ? (
              <div className="form-grid">
                <label>
                  วันที่เริ่ม
                  <input
                    name="start"
                    type="date"
                    min={today}
                    defaultValue={today}
                    required
                  />
                </label>
                <label>
                  วันที่สิ้นสุด
                  <input
                    name="end"
                    type="date"
                    min={today}
                    defaultValue={addDays(today, 7)}
                    required
                  />
                </label>
              </div>
            ) : (
              <>
                <input name="start" type="hidden" value={today} />
                <input name="end" type="hidden" value={today} />
              </>
            )}
            <label>
              เหตุผลประกอบ
              <textarea
                name="reason"
                rows={4}
                required
                placeholder="บันทึกเหตุผลการพิจารณา"
              />
            </label>
            <div className="info-strip compact">
              เก็บหลักฐานเดิมไว้ และเริ่มนับความผิดหลังการตัดสินครั้งนี้
            </div>
          </>
        ) : null}
        {action.kind === "clock" ? (
          <>
            <p>
              เวลาในต้นแบบแยกจากเวลาจริง เพื่อทดลองเช็คอิน สิ้นสุดรอบ
              และการแจ้งเตือนได้
            </p>
            <label>
              เวลาเดโม (ประเทศไทย)
              <input
                name="now"
                type="datetime-local"
                defaultValue={`${dateOf(state.now)}T${time(state.now)}`}
                min={`${dateOf(state.now)}T${time(state.now)}`}
                required
              />
            </label>
            <div className="info-strip compact">
              เมื่อยืนยัน จะตรวจ no-show ปิดรอบที่สิ้นสุด
              และจำลองส่งรายการที่อยู่ในคิว ไม่มีอีเมลจริงถูกส่ง
            </div>
            <p className="subtle">
              ข้อเสนอเรื่องหมดอายุคำขอรออนุมัติยังไม่ถูกเปิดใช้
            </p>
          </>
        ) : null}
        {action.kind === "reset" ? (
          <p>
            ข้อมูลที่ทดลองเพิ่มหรือแก้ไขในเบราว์เซอร์นี้จะถูกแทนด้วยชุดสาธิตเริ่มต้น
            เวลาเดโมจะกลับเป็น 8 ต.ค. 2569 เวลา 09:10 น.
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={close}>
            {action.kind === "book" ? "กลับไปเลือกห้อง" : "กลับ"}
          </button>
          <button className="btn" disabled={busy}>
            {busy
              ? action.kind === "book"
                ? "กำลังส่งคำขอ…"
                : "กำลังบันทึก…"
              : action.kind === "book"
                ? "ส่งคำขอจอง"
                : action.kind === "cancel"
                  ? "ยืนยันยกเลิก"
                  : action.kind === "clock"
                    ? "ใช้เวลาและประมวลผล"
                    : action.kind === "reset"
                      ? "เริ่มใหม่"
                      : "ยืนยันบันทึก"}
          </button>
        </div>
      </form>
    );
  return (
    <Modal
      title={titles[action.kind]}
      subtitle={
        action.kind === "book"
          ? "ตรวจวันเวลา แล้วระบุรายละเอียดการใช้ห้อง"
          : undefined
      }
      close={close}
      className={action.kind === "book" ? "student-booking-modal" : undefined}
    >
      {content}
    </Modal>
  );
}
