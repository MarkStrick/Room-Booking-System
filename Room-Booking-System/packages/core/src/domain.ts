import { isLocalRoomImage } from './media';
import { reportData } from './reporting';
import type {
  AppState,
  Booking,
  BookingStatus,
  Command,
  Room,
  SearchFilter,
  User,
} from "../../contracts/src/index";
import {
  advanceLifecycle,
  bookingSummary,
  releaseReservation,
} from "./lifecycle";

export const statusLabels: Record<BookingStatus, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิกแล้ว",
  CHECKED_IN: "กำลังใช้งาน",
  COMPLETED: "ใช้งานเสร็จแล้ว",
  NO_SHOW: "ไม่ได้เช็คอิน",
};
export const roleLabels = {
  USER: "ผู้จอง",
  STAFF: "เจ้าหน้าที่",
  ADMIN: "ผู้ดูแลระบบ",
};
export const activeStatuses: BookingStatus[] = [
  "PENDING",
  "APPROVED",
  "CHECKED_IN",
];
export const stamp = (date: string, time: string) => `${date}T${time}:00+07:00`;
export const ms = (s: string) => new Date(s).getTime();
export const thaiDate = (s: string, short = false) =>
  new Date(s).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: short ? "short" : "long",
    year: "numeric",
  });
export const time = (s: string) =>
  new Date(s).toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
export const dateOf = (s: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(s));
export const addDays = (date: string, n: number) =>
  dateOf(new Date(ms(stamp(date, "12:00")) + n * 86400000).toISOString());
export const overlaps = (a: string, b: string, c: string, d: string) =>
  ms(a) < ms(d) && ms(b) > ms(c);
export const canManage = (state: AppState, user: User, roomId: number) =>
  user.role === "ADMIN" ||
  (user.role === "STAFF" &&
    state.assignments.some(
      (a) =>
        a.userId === user.id &&
        a.roomIds.includes(roomId) &&
        (!a.start || dateOf(state.now) >= a.start) &&
        (!a.end || dateOf(state.now) <= a.end),
    ));
export const suspended = (state: AppState, userId: number) =>
  state.penalties.some(
    (p) =>
      p.userId === userId &&
      p.type === "SUSPENSION" &&
      dateOf(state.now) >= p.start &&
      dateOf(state.now) <= p.end,
  );
export function violationCount(state: AppState, userId: number) {
  const lastDecision = state.penalties
    .filter((p) => p.userId === userId)
    .reduce((max, p) => Math.max(max, ms(p.at)), 0);
  return state.violations.filter(
    (v) => v.userId === userId && ms(v.at) > lastDecision,
  ).length;
}
export function availability(
  state: AppState,
  room: Room,
  start: string,
  end: string,
): { label: string; kind: string; reason: string } {
  const building = state.buildings.find((b) => b.id === room.buildingId);
  if (room.active === false || building?.active === false)
    return {
      label: "เลิกใช้งาน",
      kind: "closed",
      reason: "พื้นที่นี้เลิกใช้งานแล้ว",
    };
  if (room.hours) {
    const overnight=room.hours.end<room.hours.start;
    const openingDay=overnight&&time(start)<room.hours.end?addDays(dateOf(start),-1):dateOf(start);
    const closingDay=overnight?addDays(openingDay,1):openingDay;
    const weekday = new Date(`${openingDay}T12:00:00+07:00`).getUTCDay();
    if (
      !room.hours.weekdays.includes(weekday) ||
      ms(start) < ms(stamp(openingDay,room.hours.start)) ||
      ms(end) > ms(stamp(closingDay,room.hours.end)) ||
      ms(start) < ms(state.now) + room.hours.leadMinutes * 60000
    )
      return {
        label: "นอกเวลาให้บริการ",
        kind: "closed",
        reason: "กรุณาเลือกเวลาภายในเวลาทำการและระยะจองล่วงหน้าของห้อง",
      };
  }
  if (room.status !== "AVAILABLE")
    return {
      label: room.status === "MAINTENANCE" ? "ปิดปรับปรุง" : "ปิดให้บริการ",
      kind: "closed",
      reason: room.reason,
    };
  const closure = state.closures.find(
    (c) => c.roomId === room.id && overlaps(c.start, c.end, start, end),
  );
  if (closure)
    return { label: "ปิดชั่วคราว", kind: "closed", reason: closure.reason };
  if (state.holidays.includes(dateOf(start))||state.holidays.includes(dateOf(new Date(ms(end)-1).toISOString())))
    return {
      label: "วันหยุด",
      kind: "closed",
      reason: "วันหยุดตามปฏิทินมหาวิทยาลัย",
    };
  const conflict = state.bookings.find(
    (b) =>
      b.roomId === room.id &&
      activeStatuses.includes(b.status) &&
      overlaps(b.start, b.end, start, end),
  );
  return conflict
    ? {
        label: conflict.status === "PENDING" ? "มีคำขอรออนุมัติ" : "ถูกจองแล้ว",
        kind: "busy",
        reason: `${time(conflict.start)}–${time(conflict.end)} น.`,
      }
    : { label: "ว่าง พร้อมจอง", kind: "available", reason: "" };
}
export function searchRooms(state: AppState, f: SearchFilter) {
  return state.rooms.filter(
    (r) =>
      r.active !== false &&
      state.buildings.find((b) => b.id === r.buildingId)?.active !== false &&
      (!f.floor || r.floor === Number(f.floor)) &&
      (!f.building || r.buildingId === Number(f.building)) &&
      r.capacity >= f.capacity &&
      (!f.type || r.type === f.type) &&
      (!f.amenity || r.amenities.includes(f.amenity)) &&
      (!f.query ||
        `${r.name} ${r.code}`.toLowerCase().includes(f.query.toLowerCase())),
  );
}
export const faqs = [
  {
    category: "การจอง",
    q: "จองห้องล่วงหน้าได้กี่วัน?",
    a: "จองล่วงหน้าได้ไม่เกิน 15 วัน ครั้งละ 30 นาทีถึง 4 ชั่วโมง และมีคำขอรออนุมัติพร้อมกันได้สูงสุด 3 รายการ",
    keys: ["ล่วงหน้า", "กี่วัน", "ระยะเวลา", "ชั่วโมง"],
  },
  {
    category: "การยกเลิก",
    q: "ยกเลิกการจองอย่างไร?",
    a: "เปิด “การจองของฉัน” เลือกรายการและกดยกเลิก โดยต้องเหลือเวลาก่อนเริ่มใช้งานอย่างน้อย 2 ชั่วโมง",
    keys: ["ยกเลิก", "cancel"],
  },
  {
    category: "การใช้งาน",
    q: "ต้องเช็คอินเมื่อไหร่?",
    a: "เช็คอินที่ “การจองของฉัน” เมื่อถึงเวลาเริ่ม และภายใน 30 นาที โดยต้องยังไม่ถึงเวลาสิ้นสุดการจอง หากไม่เช็คอินจะถูกบันทึกว่าไม่ได้เข้าใช้",
    keys: ["เช็คอิน", "check", "เข้าใช้"],
  },
  {
    category: "การอนุมัติ",
    q: "เจ้าหน้าที่พิจารณานานแค่ไหน?",
    a: "เจ้าหน้าที่พิจารณาภายใน 4 ชั่วโมง ติดตามผลได้จากการจองของฉันและการแจ้งเตือน",
    keys: ["อนุมัติ", "เจ้าหน้าที่", "รอ", "พิจารณา"],
  },
  {
    category: "อุปกรณ์",
    q: "ยืมอุปกรณ์เพิ่มเติมได้ไหม?",
    a: "เลือกอุปกรณ์และจำนวนในฟอร์มจอง ระบบจะกันจำนวนจากกองกลางเมื่อส่งคำขอ อุปกรณ์ประจำห้องไม่ต้องขอยืมซ้ำ",
    keys: ["อุปกรณ์", "ยืม", "โปรเจกเตอร์"],
  },
  {
    category: "สิทธิ์",
    q: "ถูกระงับสิทธิ์ต้องทำอย่างไร?",
    a: "ตรวจช่วงวันที่และเหตุผลที่หน้าข้อมูลส่วนตัว แล้วติดต่อเจ้าหน้าที่ผู้ดูแลหากต้องการสอบถาม การตักเตือนไม่ใช่การระงับสิทธิ์",
    keys: ["สิทธิ์", "ระงับ", "บทลงโทษ"],
  },
];
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
// Only deliberate business rejections carry state that must be persisted.
// Validation, authorization and unexpected failures still roll back normally.
export class RecordedRejection extends DomainError {
  constructor(
    code: string,
    message: string,
    public state: AppState,
  ) {
    super(code, message);
  }
}
function requireRule(
  ok: unknown,
  message: string,
  code = "RULE_VIOLATION",
): asserts ok {
  if (!ok) throw new DomainError(code, message);
}
const nextId = (rows: { id: number }[]) =>
  Math.max(0, ...rows.map((r) => r.id)) + 1;

export function executeCommand(
  previous: AppState,
  actorId: number,
  c: Command,
): AppState {
  const s = structuredClone(previous);
  const actor = s.users.find((u) => u.id === actorId);
  if (!actor || !actor.active)
    throw new DomainError("UNAUTHORIZED", "บัญชีไม่พร้อมใช้งาน");
  const admin = () =>
    requireRule(
      actor.role === "ADMIN",
      "เฉพาะผู้ดูแลระบบเท่านั้น",
      "FORBIDDEN",
    );
  const log = (text: string, bookingId?: number, system = false) =>
    s.audit.unshift({
      id: nextId(s.audit),
      at: s.now,
      actorId: system ? null : actor.id,
      text,
      bookingId,
    });
  const notify = (
    userId: number,
    subject: string,
    content: string,
    bookingId?: number,
  ) =>
    s.notices.unshift({
      id: nextId(s.notices),
      userId,
      subject,
      content: bookingId
        ? `${bookingSummary(
            s,
            s.bookings.find((b) => b.id === bookingId)!,
          )}\n${content}`
        : content,
      bookingId,
      status: "QUEUED",
      createdAt: s.now,
      attempts: 0,
    });
  const release = (b: Booking) => releaseReservation(s, b);
  const getBooking = (id: number) => {
    const b = s.bookings.find((b) => b.id === id);
    if (!b) throw new DomainError("NOT_FOUND", "ไม่พบรายการจอง");
    return b;
  };
  switch (c.type) {
    case "REPORT_SAVE": {
      requireRule(actor.role === "STAFF" || actor.role === "ADMIN", "เฉพาะเจ้าหน้าที่และผู้ดูแลระบบ", "FORBIDDEN_REPORT");
      if(c.buildingId!==undefined)requireRule(s.buildings.some(b=>b.id===c.buildingId), "ไม่พบอาคาร");
      const rooms=s.rooms.filter(r=>canManage(s,actor,r.id)&&(c.buildingId===undefined||r.buildingId===c.buildingId));
      requireRule(rooms.length>0,"ไม่มีห้องในขอบเขตที่เลือก");
      const result=reportData(s,rooms,c.from,c.to);
      requireRule(result.valid,"กรุณาตรวจวันที่ ช่วงรายงานต้องไม่เกิน 366 วัน");
      const reports=s.reports??(s.reports=[]);
      reports.unshift({id:nextId(reports),userId:actor.id,from:c.from,to:c.to,buildingId:c.buildingId,roomIds:rooms.map(r=>r.id),totalBookings:result.rows.length,totalHours:Math.round(result.hours*100)/100,canceledCount:result.rows.filter(b=>b.status==='CANCELLED').length,createdAt:s.now});
      log(`บันทึกรายงาน ${c.from} ถึง ${c.to}`);
      break;
    }
    case "EQUIPMENT_ACTIVE": {
      admin();
      const item=s.equipment.find(e=>e.id===c.equipmentId);
      requireRule(item,"ไม่พบอุปกรณ์");
      requireRule(c.active || item.total===item.remaining,"อุปกรณ์ยังมีการจองหรือค้างคืน");
      item.active=c.active;
      log(`${c.active?'เปิด':'เลิก'}ใช้งานอุปกรณ์ ${item.name}`);
      break;
    }
    case "BOOK": {
      const r = s.rooms.find((r) => r.id === c.roomId);
      requireRule(r, "ไม่พบห้อง");
      requireRule(!suspended(s, actor.id), "คุณอยู่ระหว่างระงับสิทธิ์การจอง");
      requireRule(
        Number.isFinite(ms(c.start)) && Number.isFinite(ms(c.end)),
        "กรุณาระบุวันเวลาที่ถูกต้อง",
      );
      const duration = (ms(c.end) - ms(c.start)) / 60000;
      requireRule(
        duration >= 30 && duration <= 240,
        "ระยะเวลาจองต้องอยู่ระหว่าง 30 นาทีถึง 4 ชั่วโมง",
      );
      requireRule(ms(c.start) > ms(s.now), "ไม่สามารถจองช่วงเวลาที่ผ่านไปแล้ว");
      requireRule(
        dateOf(c.start) <= addDays(dateOf(s.now), 15),
        "จองล่วงหน้าได้ไม่เกิน 15 วัน",
      );
      requireRule(
        availability(s, r, c.start, c.end).kind === "available",
        "ห้องไม่ว่างในช่วงเวลานี้ กรุณาเลือกเวลาอื่น",
        "ROOM_TIME_CONFLICT",
      );
      requireRule(
        s.bookings.filter(
          (b) => b.userId === actor.id && b.status === "PENDING",
        ).length < 3,
        "มีคำขอรออนุมัติครบ 3 รายการแล้ว",
        "PENDING_LIMIT_REACHED",
      );
      requireRule(
        c.purpose.trim() &&
          Number.isInteger(c.attendees) &&
          c.attendees > 0 &&
          c.attendees <= r.capacity,
        "กรุณาระบุวัตถุประสงค์และจำนวนผู้เข้าร่วมไม่เกินความจุห้อง",
      );
      requireRule(
        c.participants.every(
          (id) => id !== actor.id && s.users.some((u) => u.id === id),
        ),
        "รายชื่อผู้เข้าร่วมไม่ถูกต้อง",
      );
      const emails = (c.participantEmails ?? []).map((e) =>
        e.trim().toLowerCase(),
      );
      requireRule(
        emails.every(
          (e) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) &&
            e !== actor.email.toLowerCase(),
        ) &&
          new Set(emails).size === emails.length &&
          emails.length + c.participants.length + 1 <= c.attendees,
        "อีเมลผู้ร่วมใช้งานต้องไม่ซ้ำ ไม่ใช่อีเมลผู้จอง และจำนวนรวมต้องไม่เกินจำนวนคน",
      );
      requireRule(
        new Set(c.equipment.map((e) => e.id)).size === c.equipment.length,
        "รายการอุปกรณ์ซ้ำ",
      );
      for (const item of c.equipment) {
        const e = s.equipment.find((e) => e.id === item.id);
        requireRule(
          e &&
            e.active !== false &&
            Number.isInteger(item.qty) &&
            item.qty > 0 &&
            e.remaining >= item.qty,
          "จำนวนอุปกรณ์คงเหลือไม่เพียงพอ",
          "EQUIPMENT_UNAVAILABLE",
        );
        e.remaining -= item.qty;
      }
      const id = nextId(s.bookings);
      const b: Booking = {
        id,
        ref: `BK-${Number(dateOf(s.now).slice(0, 4)) + 543}-${String(id).padStart(4, "0")}`,
        userId: actor.id,
        roomId: r.id,
        start: c.start,
        end: c.end,
        purpose: c.purpose.trim(),
        attendees: c.attendees,
        participants: c.participants,
        participantEmails: c.participantEmails?.map((e) =>
          e.trim().toLowerCase(),
        ),
        approvalDeadline: new Date(ms(s.now) + 4 * 3600000).toISOString(),
        equipment: c.equipment,
        status: "PENDING",
        createdAt: s.now,
      };
      s.bookings.unshift(b);
      log(`ส่งคำขอ ${b.ref}`, id);
      notify(
        actor.id,
        "ได้รับคำขอจองแล้ว",
        `${r.name} • ${thaiDate(b.start)} ${time(b.start)}–${time(b.end)} น.`,
        id,
      );
      s.users
        .filter(
          (u) =>
            u.role === "ADMIN" || (u.role === "STAFF" && canManage(s, u, r.id)),
        )
        .forEach((u) =>
          notify(
            u.id,
            "มีคำขอรอพิจารณา",
            `${b.ref} • ${actor.name} • ${r.name}`,
            id,
          ),
        );
      break;
    }
    case "CANCEL": {
      const b = getBooking(c.bookingId);
      requireRule(
        b.userId === actor.id,
        "ยกเลิกได้เฉพาะการจองของตนเอง",
        "FORBIDDEN",
      );
      requireRule(
        ["PENDING", "APPROVED"].includes(b.status),
        "สถานะนี้ไม่สามารถยกเลิกได้",
      );
      if (ms(b.start) - ms(s.now) < 2 * 3600000) {
        if (
          !s.violations.some(
            (v) => v.bookingId === b.id && v.type === "LATE_CANCEL",
          )
        ) {
          s.violations.push({
            id: nextId(s.violations),
            userId: actor.id,
            bookingId: b.id,
            type: "LATE_CANCEL",
            at: s.now,
          });
          log(`ปฏิเสธการยกเลิกช้า ${b.ref} • บันทึกความผิด LATE_CANCEL`, b.id);
        }
        throw new RecordedRejection(
          "CANCELLATION_TOO_LATE",
          "ยกเลิกไม่ได้ ต้องแจ้งก่อนเริ่มอย่างน้อย 2 ชั่วโมง บันทึกความผิดแล้ว 1 ครั้งสำหรับรายการนี้",
          s,
        );
      }
      b.status = "CANCELLED";
      b.reason = "ผู้จองยกเลิก";
      release(b);
      log(`ยกเลิก ${b.ref}`, b.id);
      notify(b.userId, "ยืนยันการยกเลิก", `ยกเลิกแล้ว • ${b.reason}`, b.id);
      break;
    }
    case "CHECKIN": {
      const b = getBooking(c.bookingId);
      requireRule(
        b.userId === actor.id,
        "เช็คอินได้เฉพาะรายการของตนเอง",
        "FORBIDDEN",
      );
      requireRule(!suspended(s, actor.id), "บัญชีอยู่ระหว่างระงับสิทธิ์");
      requireRule(
        b.status === "APPROVED",
        "ต้องเป็นรายการที่อนุมัติแล้วและยังไม่เช็คอิน",
      );
      requireRule(
        ms(s.now) >= ms(b.start) &&
          ms(s.now) <= ms(b.start) + 1800000 &&
          ms(s.now) < ms(b.end),
        "ยังไม่อยู่ในช่วงเช็คอิน หรือพ้นกำหนดแล้ว",
        "CHECKIN_WINDOW_CLOSED",
      );
      b.status = "CHECKED_IN";
      b.checkedInAt = s.now;
      log(`เช็คอิน ${b.ref}`, b.id);
      break;
    }
    case "DECIDE": {
      const b = getBooking(c.bookingId);
      requireRule(
        canManage(s, actor, b.roomId),
        "คุณไม่ได้รับมอบหมายให้ดูแลห้องนี้",
        "FORBIDDEN_ROOM_SCOPE",
      );
      requireRule(
        b.status === "PENDING",
        "รายการนี้ได้รับการพิจารณาหรือยกเลิกแล้ว",
      );
      requireRule(
        !c.approve || ms(b.start) > ms(s.now),
        "เวลาเริ่มการจองผ่านไปแล้ว",
      );
      requireRule(c.approve || c.reason.trim(), "กรุณาระบุเหตุผลที่ไม่อนุมัติ");
      const r = s.rooms.find((r) => r.id === b.roomId)!;
      if (c.approve) {
        requireRule(
          b.attendees <= r.capacity,
          `อนุมัติไม่ได้ คำขอมี ${b.attendees} คน แต่ห้องรองรับได้ ${r.capacity} คน กรุณาตรวจสอบความจุหรือปฏิเสธคำขอพร้อมเหตุผล`,
          "ROOM_CAPACITY_EXCEEDED",
        );
        const withoutSelf = {
          ...s,
          bookings: s.bookings.filter((x) => x.id !== b.id),
        };
        requireRule(
          availability(withoutSelf, r, b.start, b.end).kind === "available",
          "ห้องไม่พร้อมหรือมีรายการอื่นซ้อนทับ",
        );
      }
      b.status = c.approve ? "APPROVED" : "REJECTED";
      b.decidedBy = actor.id;
      b.decidedAt = s.now;
      b.reason = c.reason.trim();
      if (!c.approve) release(b);
      log(`${c.approve ? "อนุมัติ" : "ไม่อนุมัติ"} ${b.ref}`, b.id);
      notify(
        b.userId,
        c.approve ? "คำขอได้รับการอนุมัติ" : "คำขอไม่ได้รับการอนุมัติ",
        `${b.ref} • ${c.approve ? r.name : b.reason}`,
        b.id,
      );
      break;
    }
    case "ROOM_SAVE": {
      admin();
      const r = c.room;
      const building = s.buildings.find((b) => b.id === r.buildingId);
      const previous = s.rooms.find((x) => x.id === r.id);
      requireRule(
        !previous ||
          JSON.stringify(previous.hours) === JSON.stringify(r.hours) ||
          !s.bookings.some(
            (b) => b.roomId === r.id && activeStatuses.includes(b.status),
          ),
        "กรุณาจัดการการจองที่ยังมีผลก่อนเปลี่ยนเวลาทำการ",
      );
      requireRule(
        !r.id || s.rooms.some((x) => x.id === r.id),
        "ไม่พบห้องที่แก้ไข",
      );
      requireRule(building?.active !== false, "อาคารเลิกใช้งานแล้ว");
      requireRule(
        !r.imageUrl || /^https:\/\//.test(r.imageUrl) || isLocalRoomImage(r.imageUrl),
        "รูปห้องต้องเป็นลิงก์ HTTPS หรือรูปในโฟลเดอร์ room-images ของเว็บ",
      );
      requireRule(
        (r.inventory ?? []).every(
          (i) =>
            i.name.trim() &&
            Number.isInteger(i.id) &&
            i.id > 0 &&
            Number.isInteger(i.total) &&
            i.total > 0 &&
            Number.isInteger(i.damaged) &&
            i.damaged >= 0 &&
            i.damaged <= i.total,
        ) &&
          new Set(r.inventory?.map((i) => i.id)).size ===
            (r.inventory ?? []).length,
        "รายการอุปกรณ์ประจำห้องไม่ถูกต้อง",
      );
      requireRule(
        !r.hours ||
          (/^([01]\d|2[0-3]):[0-5]\d$/.test(r.hours.start) &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(r.hours.end) &&
            r.hours.end !== r.hours.start &&
            r.hours.weekdays.length > 0 &&
            r.hours.weekdays.every(
              (d) => Number.isInteger(d) && d >= 0 && d <= 6,
            ) &&
            Number.isInteger(r.hours.leadMinutes) &&
            r.hours.leadMinutes >= 0 &&
            r.hours.leadMinutes <= 1440),
        "เวลาทำการไม่ถูกต้อง",
      );
      requireRule(
        r.active !== false ||
          !s.bookings.some(
            (b) => b.roomId === r.id && activeStatuses.includes(b.status),
          ),
        "ห้องมีการจองค้างอยู่",
      );
      requireRule(
        building &&
          r.name.trim() &&
          r.code.trim() &&
          Number.isInteger(r.floor) &&
          r.floor > 0 &&
          r.floor <= building.floors &&
          Number.isInteger(r.capacity) &&
          r.capacity > 0,
        "กรุณาตรวจชื่อ ความจุ อาคาร และชั้น",
      );
      const overCapacity = s.bookings.filter(
        (b) =>
          b.roomId === r.id &&
          activeStatuses.includes(b.status) &&
          b.attendees > r.capacity,
      );
      requireRule(
        overCapacity.length === 0,
        `บันทึกความจุนี้ไม่ได้ มี ${overCapacity.length} รายการจองที่ยังมีผลและจำนวนคนเกิน ${r.capacity} คน กรุณาจัดการรายการเหล่านี้ก่อน`,
        "ROOM_CAPACITY_CONFLICT",
      );
      requireRule(
        !s.rooms.some(
          (x) =>
            x.id !== r.id &&
            (x.code === r.code.trim() ||
              (x.buildingId === r.buildingId &&
                x.floor === r.floor &&
                x.name === r.name.trim())),
        ),
        "รหัสหรือชื่อห้องในชั้นเดียวกันซ้ำ",
      );
      requireRule(
        r.status === "AVAILABLE" || r.reason.trim(),
        "กรุณาระบุเหตุผลที่ปิดห้อง",
      );
      if (r.id && r.status !== "AVAILABLE")
        requireRule(
          !s.bookings.some(
            (b) => b.roomId === r.id && activeStatuses.includes(b.status),
          ),
          "ห้องมีการจองค้างอยู่ ใช้ปิดห้องชั่วคราวเพื่อแจ้งผู้ได้รับผลกระทบ",
        );
      const record: Room = {
        ...r,
        active: r.active ?? previous?.active,
        id: r.id ?? nextId(s.rooms),
        name: r.name.trim(),
        code: r.code.trim(),
      };
      s.rooms = [...s.rooms.filter((x) => x.id !== record.id), record];
      log(`บันทึกห้อง ${record.code}`);
      break;
    }
    case "CLOSE_ROOM": {
      admin();
      requireRule(
        s.rooms.some((r) => r.id === c.roomId) &&
          Number.isFinite(ms(c.start)) &&
          Number.isFinite(ms(c.end)) &&
          ms(c.end) > ms(c.start) &&
          ms(c.start) >= ms(s.now) &&
          c.reason.trim(),
        "กรุณาระบุช่วงเวลาในอนาคตและเหตุผล",
      );
      const affected = s.bookings.filter(
        (b) =>
          b.roomId === c.roomId &&
          activeStatuses.includes(b.status) &&
          overlaps(b.start, b.end, c.start, c.end),
      );
      requireRule(
        !affected.some((b) => b.status === "CHECKED_IN"),
        "มีผู้กำลังใช้ห้อง กรุณาให้เจ้าหน้าที่จัดการก่อน",
      );
      s.closures.push({
        id: nextId(s.closures),
        roomId: c.roomId,
        start: c.start,
        end: c.end,
        reason: c.reason.trim(),
      });
      affected.forEach((b) => {
        b.status = "CANCELLED";
        b.reason = `ปิดห้อง: ${c.reason}`;
        release(b);
        log(`ยกเลิกจากการปิดห้อง ${b.ref}`, b.id);
        notify(
          b.userId,
          "ห้องปิดชั่วคราว",
          `${b.ref} ถูกยกเลิก • ${c.reason}`,
          b.id,
        );
      });
      log(`ปิดห้องชั่วคราว ${s.rooms.find((r) => r.id === c.roomId)!.code}`);
      break;
    }
    case "INSPECT": {
      requireRule(
        canManage(s, actor, c.roomId),
        "ไม่มีสิทธิ์ตรวจห้องนี้",
        "FORBIDDEN_ROOM_SCOPE",
      );
      const inspectedRoom = s.rooms.find((r) => r.id === c.roomId);
      requireRule(inspectedRoom, "ไม่พบห้อง");
      const inventory = inspectedRoom.inventory ?? [];
      requireRule(
        (c.items ?? []).length === inventory.length &&
          new Set(c.items?.map((i) => i.id)).size === inventory.length,
        "กรุณาตรวจอุปกรณ์ทุกรายการ",
      );
      for (const item of c.items ?? []) {
        const asset = inventory.find((a) => a.id === item.id);
        requireRule(
          asset &&
            Number.isInteger(item.damaged) &&
            item.damaged >= 0 &&
            item.damaged <= asset.total,
          "จำนวนอุปกรณ์ชำรุดไม่ถูกต้อง",
        );
        asset.damaged = item.damaged;
      }
      requireRule(
        !inventory.some((i) => i.damaged > 0) || c.condition !== "พร้อมใช้งาน",
        "พบอุปกรณ์ชำรุด กรุณาเลือกผลตรวจให้ตรงกับสภาพจริง",
      );
      const maintenance = c.condition !== "พร้อมใช้งาน";
      const affected = maintenance ? s.bookings.filter(b => b.roomId === c.roomId && activeStatuses.includes(b.status) && ms(b.end) > ms(s.now)) : [];
      requireRule(!affected.some(b => b.status === "CHECKED_IN"), "มีผู้กำลังใช้ห้อง กรุณาจัดการการใช้งานก่อนปิดปรับปรุง");
      requireRule(!affected.length || c.closeAffected === true, "มีการจองได้รับผลกระทบ กรุณายืนยันการยกเลิกก่อนปิดปรับปรุง");
      affected.forEach(b => {
        b.status = "CANCELLED";
        b.reason = `ปิดปรับปรุงจากผลตรวจ: ${c.condition}${c.note ? " • " + c.note : ""}`;
        release(b); log(`ยกเลิกจากผลตรวจ ${b.ref}`, b.id);
        notify(b.userId, "ห้องปิดชั่วคราว", `${b.ref} ถูกยกเลิก • ${b.reason}`, b.id);
      });
      // An inspection may reopen maintenance, but must not override a deliberate closure.
      if (maintenance || inspectedRoom.status === "MAINTENANCE") {
        inspectedRoom.status = maintenance ? "MAINTENANCE" : "AVAILABLE";
        inspectedRoom.reason = maintenance ? `${c.condition}${c.note ? " • " + c.note : ""}` : "";
      }
      s.inspections.unshift({
        id: nextId(s.inspections),
        roomId: c.roomId,
        at: s.now,
        condition: c.condition,
        note: c.note,
        actorId,
        items: structuredClone(inventory),
      });
      log("บันทึกผลตรวจห้อง");
      break;
    }
    case "BUILDING_SAVE": {
      admin();
      requireRule(
        c.name.trim() && Number.isInteger(c.floors) && c.floors > 0,
        "กรุณาระบุชื่ออาคารและจำนวนชั้น",
      );
      requireRule(
        !s.buildings.some((b) => b.id !== c.id && b.name === c.name.trim()),
        "ชื่ออาคารซ้ำ",
      );
      requireRule(
        !s.rooms.some((r) => r.buildingId === c.id && r.floor > c.floors),
        "มีห้องอยู่ชั้นสูงกว่าจำนวนชั้นที่ระบุ",
      );
      const id = c.id ?? nextId(s.buildings);
      s.buildings = [
        ...s.buildings.filter((b) => b.id !== id),
        {
          id,
          name: c.name.trim(),
          floors: c.floors,
          levels: s.buildings.find(b => b.id === id)?.levels?.filter(f => f.number <= c.floors),
          active: s.buildings.find((b) => b.id === id)?.active,
        },
      ];
      log(`บันทึกอาคาร ${c.name}`);
      break;
    }
    case "FLOOR_SAVE": {
      admin();
      const building = s.buildings.find(b => b.id === c.buildingId);
      requireRule(building && building.active !== false, "ไม่พบอาคารที่เปิดใช้งาน");
      requireRule(Number.isInteger(c.number) && c.number > 0 && c.number <= building.floors + 1 && c.name.trim(), "กรุณาระบุชื่อชั้นและเลขชั้นถัดจากชั้นที่มีอยู่");
      const levels = Array.from({length:building.floors}, (_, i) => building.levels?.find(f => f.number === i + 1) ?? {id:`floor-${building.id}-${i+1}`,number:i+1,name:`ชั้น ${i+1}`});
      requireRule(!levels.some(f => f.number !== c.number && f.name === c.name.trim()), "ชื่อชั้นในอาคารนี้ซ้ำ");
      building.levels = [...levels.filter(f => f.number !== c.number), {id:`floor-${building.id}-${c.number}`,number:c.number,name:c.name.trim()}].sort((a,b)=>a.number-b.number);
      building.floors = Math.max(building.floors, c.number);
      log(`บันทึกชั้น ${c.number} อาคาร ${building.name}`);
      break;
    }
    case "SEND_NOTICE": {
      const recipient = s.users.find(u => u.active && u.email.toLowerCase() === c.recipientEmail.trim().toLowerCase());
      requireRule(recipient && (recipient.id === actor.id || actor.role === "ADMIN"), "ส่งได้เฉพาะอีเมลบัญชีของคุณ หรือบัญชีที่ผู้ดูแลเลือก", "FORBIDDEN");
      requireRule(s.notices.filter(n => n.userId === recipient.id && ms(n.createdAt) > ms(s.now)-600000 && n.subject.startsWith("ส่งซ้ำ:")).length < 3, "ส่งได้ไม่เกิน 3 ครั้งต่อผู้รับใน 10 นาที");
      if(c.notificationType === "GENERAL") {
        admin(); requireRule(c.message?.trim(), "กรุณาระบุข้อความแจ้งเตือน");
          notify(recipient.id, "ส่งซ้ำ: แจ้งข้อความจากผู้ดูแล", c.message!.trim());
      } else {
        const b = getBooking(c.bookingId ?? 0);
        requireRule(b.userId === recipient.id && (b.userId === actor.id || canManage(s,actor,b.roomId)), "ไม่มีสิทธิ์ส่งรายละเอียดการจองนี้", "FORBIDDEN");
        requireRule(c.notificationType !== "CANCELLATION" || b.status === "CANCELLED", "รายการนี้ยังไม่ได้ยกเลิก");
        requireRule(c.notificationType !== "REMINDER" || b.status === "APPROVED", "ส่งเตือนได้เฉพาะรายการที่อนุมัติแล้ว");
        const title = c.notificationType === "CANCELLATION" ? "ยืนยันการยกเลิก" : c.notificationType === "REMINDER" ? "แจ้งเตือนการใช้ห้อง" : "ยืนยันสถานะการจอง";
        notify(recipient.id, `ส่งซ้ำ: ${title}`, `${statusLabels[b.status]}${b.reason ? " • " + b.reason : ""}`, b.id);
      }
      log(`เข้าคิวอีเมลตามคำขอ ${recipient.id}`, c.bookingId);
      break;
    }
    case "ROOM_ACTIVE": {
      admin();
      const room = s.rooms.find((r) => r.id === c.roomId);
      requireRule(room, "ไม่พบห้อง");
      requireRule(
        c.active ||
          !s.bookings.some(
            (b) => b.roomId === room.id && activeStatuses.includes(b.status),
          ),
        "กรุณาจัดการการจองที่ยังมีผลก่อนเลิกใช้งานห้อง",
      );
      requireRule(
        !c.active ||
          s.buildings.find((b) => b.id === room.buildingId)?.active !== false,
        "กรุณาเปิดใช้งานอาคารก่อน",
      );
      room.active = c.active;
      log(`${c.active ? "เปิด" : "เลิก"}ใช้งานห้อง ${room.code}`);
      break;
    }
    case "BUILDING_ACTIVE": {
      admin();
      const building = s.buildings.find((b) => b.id === c.buildingId);
      requireRule(building, "ไม่พบอาคาร");
      const rooms = s.rooms.filter((r) => r.buildingId === building.id);
      requireRule(
        c.active ||
          !s.bookings.some(
            (b) =>
              rooms.some((r) => r.id === b.roomId) &&
              activeStatuses.includes(b.status),
          ),
        "กรุณาจัดการการจองในอาคารก่อนเลิกใช้งาน",
      );
      building.active = c.active;
      log(`${c.active ? "เปิด" : "เลิก"}ใช้งานอาคาร ${building.name}`);
      break;
    }
    case "ROOM_DELETE": {
      admin();
      requireRule(
        s.rooms.some((r) => r.id === c.roomId),
        "ไม่พบห้อง",
      );
      requireRule(
        !s.bookings.some((b) => b.roomId === c.roomId) &&
          !s.inspections.some((i) => i.roomId === c.roomId) &&
          !s.closures.some((i) => i.roomId === c.roomId),
        "ห้องมีประวัติ กรุณาใช้เลิกใช้งานแทนลบ",
      );
      s.rooms.find((r) => r.id === c.roomId)!.active = false;
      s.assignments.forEach(
        (a) => (a.roomIds = a.roomIds.filter((id) => id !== c.roomId)),
      );
      log(`เลิกใช้งานห้อง ${c.roomId} โดยเก็บข้อมูลย้อนหลัง`);
      break;
    }
    case "BUILDING_DELETE": {
      admin();
      requireRule(
        s.buildings.some((b) => b.id === c.buildingId),
        "ไม่พบอาคาร",
      );
      requireRule(
        !s.rooms.some((r) => r.buildingId === c.buildingId),
        "อาคารยังมีห้อง กรุณาใช้เลิกใช้งานหรือจัดการห้องก่อน",
      );
      s.buildings.find((b) => b.id === c.buildingId)!.active = false;
      log(`เลิกใช้งานอาคาร ${c.buildingId} โดยเก็บข้อมูลย้อนหลัง`);
      break;
    }
    case "EQUIPMENT_HANDOVER": {
      const b = getBooking(c.bookingId);
      requireRule(
        canManage(s, actor, b.roomId),
        "ไม่มีสิทธิ์จัดการอุปกรณ์ห้องนี้",
        "FORBIDDEN_ROOM_SCOPE",
      );
      const item = b.equipment.find((i) => i.id === c.equipmentId),
        equipment = s.equipment.find((e) => e.id === c.equipmentId);
      requireRule(
        item && equipment && Number.isInteger(c.qty) && c.qty > 0,
        "รายการอุปกรณ์ไม่ถูกต้อง",
      );
      if (c.action === "ISSUE") {
        requireRule(
          b.status === "CHECKED_IN" && c.qty <= item.qty - (item.issued ?? 0),
          "จ่ายได้หลังเช็คอินและไม่เกินยอดที่จอง",
        );
        item.issued = (item.issued ?? 0) + c.qty;
      } else {
        requireRule(
          c.qty <= (item.issued ?? 0) - (item.returned ?? 0),
          "จำนวนคืนเกินจำนวนที่ค้างคืน",
        );
        item.returned = (item.returned ?? 0) + c.qty;
        equipment.remaining = Math.min(
          equipment.total,
          equipment.remaining + c.qty,
        );
      }
      log(
        `${c.action === "ISSUE" ? "จ่าย" : "รับคืน"} ${equipment.name} ${c.qty} ชิ้น`,
        b.id,
      );
      break;
    }
    case "SETTINGS_SAVE": {
      admin();
      requireRule(
        c.faqs.length > 0 &&
          c.faqs.every((f) => f.q.trim() && f.a.trim() && f.keys.length),
        "กรุณาระบุ FAQ ให้ครบ",
      );
      requireRule(
        !c.contactEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contactEmail),
        "อีเมลติดต่อไม่ถูกต้อง",
      );
      s.settings = {
        ...s.settings,
        contactEmail: c.contactEmail.trim(),
        contactPhone: c.contactPhone.trim(),
        faqs: structuredClone(c.faqs),
      };
      log("บันทึก FAQ และช่องทางติดต่อ");
      break;
    }
    case "HOLIDAY_SAVE": {
      admin();
      requireRule(
        /^\d{4}-\d{2}-\d{2}$/.test(c.date) &&
          Number.isFinite(Date.parse(`${c.date}T12:00:00Z`)) &&
          new Date(`${c.date}T12:00:00Z`).toISOString().slice(0, 10) === c.date,
        "กรุณาระบุวันที่ที่มีอยู่จริง",
        "INVALID_HOLIDAY_DATE",
      );
      requireRule(
        !c.previousDate || s.holidays.includes(c.previousDate),
        "ไม่พบวันหยุดที่ต้องการแก้ไข",
        "HOLIDAY_NOT_FOUND",
      );
      requireRule(
        c.date === c.previousDate || !s.holidays.includes(c.date),
        "วันที่นี้เป็นวันหยุดอยู่แล้ว",
        "HOLIDAY_DUPLICATE",
      );
      if (c.date !== c.previousDate) {
        const affected = s.bookings.filter(
          (b) =>
            ["PENDING", "APPROVED", "CHECKED_IN"].includes(b.status) &&
            overlaps(b.start,b.end,stamp(c.date,'00:00'),stamp(addDays(c.date,1),'00:00')),
        );
        requireRule(
          !affected.length,
          `วันที่นี้มีการจองที่ยังดำเนินการอยู่ ${affected.length} รายการ กรุณาจัดการการจองก่อนเพิ่มวันหยุด`,
          "HOLIDAY_BOOKING_CONFLICT",
        );
      }
      s.holidays = [...s.holidays.filter((d) => d !== c.previousDate), c.date]
        .filter((d, i, dates) => dates.indexOf(d) === i)
        .sort();
      log(
        c.previousDate
          ? `แก้ไขวันหยุด ${c.previousDate} เป็น ${c.date}`
          : `เพิ่มวันหยุด ${c.date}`,
      );
      break;
    }
    case "HOLIDAY_DELETE": {
      admin();
      requireRule(
        s.holidays.includes(c.date),
        "ไม่พบวันหยุดที่ต้องการลบ",
        "HOLIDAY_NOT_FOUND",
      );
      s.holidays = s.holidays.filter((d) => d !== c.date);
      log(`ลบวันหยุด ${c.date}`);
      break;
    }
    case "EQUIPMENT_SAVE": {
      admin();
      const old = s.equipment.find((e) => e.id === c.id);
      const held = old ? old.total - old.remaining : 0;
      requireRule(
        c.name.trim() &&
          Number.isInteger(c.total) &&
          c.total >= held &&
          c.total >= 0,
        "จำนวนรวมต้องไม่น้อยกว่าจำนวนที่ถูกกันไว้",
      );
      const id = c.id ?? nextId(s.equipment);
      s.equipment = [
        ...s.equipment.filter((e) => e.id !== id),
        { id, name: c.name.trim(), total: c.total, remaining: c.total - held, active: old?.active??true, createdBy:old?old.createdBy:actor.id },
      ];
      log(`บันทึกอุปกรณ์ ${c.name}`);
      break;
    }
    case "PENALTY": {
      admin();
      requireRule(
        s.users.some((u) => u.id === c.userId) &&
          violationCount(s, c.userId) >= 3,
        "ผู้ใช้ต้องมีความผิดถึงเกณฑ์ 3 ครั้ง",
      );
      requireRule(!suspended(s, c.userId), "ผู้ใช้อยู่ระหว่างระงับสิทธิ์แล้ว");
      requireRule(c.reason.trim(), "กรุณาระบุเหตุผลการพิจารณา");
      requireRule(
        c.penaltyType === "WARNING" ||
          (c.start >= dateOf(s.now) &&
            c.end >= c.start &&
            /^\d{4}-\d{2}-\d{2}$/.test(c.end)),
        "กรุณาตรวจวันที่เริ่มและสิ้นสุด",
      );
      s.penalties.unshift({
        id: nextId(s.penalties),
        userId: c.userId,
        type: c.penaltyType,
        start: c.start,
        end: c.end,
        reason: c.reason.trim(),
        at: s.now,
        actorId,
      });
      log(`พิจารณาบทลงโทษ ${s.users.find((u) => u.id === c.userId)!.name}`);
      notify(
        c.userId,
        c.penaltyType === "WARNING" ? "แจ้งการตักเตือน" : "แจ้งระงับสิทธิ์",
        c.reason,
      );
      break;
    }
    case "PROFILE":
      requireRule(
        c.name.trim() && /^[0-9+ -]{8,20}$/.test(c.phone),
        "กรุณาระบุชื่อและเบอร์โทรที่ถูกต้อง",
      );
      actor.name = c.name.trim();
      actor.phone = c.phone;
      log("แก้ไขข้อมูลส่วนตัว");
      break;
    case "SUPPORT_REQUEST": {
      requireRule(
        c.question.trim() && c.question.length <= 1000,
        "กรุณาระบุคำถามไม่เกิน 1,000 ตัวอักษร",
      );
      const admins = s.users.filter((u) => u.active && u.role === "ADMIN");
      requireRule(admins.length, "ยังไม่มีผู้ดูแลที่รับคำถามได้");
      admins.forEach((u) =>
        notify(
          u.id,
          "คำถามถึงผู้ดูแล",
          `${actor.name} (${actor.email})\n${c.question.trim()}`,
        ),
      );
      s.messages.push({
        id: nextId(s.messages),
        userId: actor.id,
        question: c.question.trim(),
        answer: "ส่งคำถามให้ผู้ดูแลแล้ว ผู้ดูแลจะติดต่อกลับตามข้อมูลบัญชี",
        at: s.now,
      });
      log("ส่งคำถามถึงผู้ดูแล");
      break;
    }
    case "HELP": {
      requireRule(
        c.question.trim() && c.question.length <= 1000,
        "กรุณาระบุคำถามไม่เกิน 1,000 ตัวอักษร",
      );
      const reference = c.question.match(/BK-\d{4}-\d+/i)?.[0].toUpperCase();
      const own = reference
        ? s.bookings.find((b) => b.ref === reference && b.userId === actor.id)
        : undefined;
      const faq = (s.settings?.faqs.length ? s.settings.faqs : faqs).find((f) =>
        f.keys.some((k) => c.question.toLowerCase().includes(k)),
      );
      s.messages.push({
        id: nextId(s.messages),
        userId: actorId,
        question: c.question.trim(),
        answer: reference
          ? own
            ? `${bookingSummary(s, own)} • ${statusLabels[own.status]}${own.reason ? " • " + own.reason : ""}`
            : "ไม่พบรายการจองนี้ในบัญชีของคุณ"
          : (faq?.a ??
            `ยังไม่พบคำตอบ กรุณาติดต่อเจ้าหน้าที่${s.settings?.contactEmail ? " " + s.settings.contactEmail : ""}${s.settings?.contactPhone ? " โทร " + s.settings.contactPhone : ""}`),
        at: s.now,
      });
      break;
    }
    case "READ_NOTICE": {
      const notice = s.notices.find(
        (n) => n.id === c.noticeId && n.userId === actor.id,
      );
      requireRule(notice, "ไม่พบการแจ้งเตือนของคุณ", "FORBIDDEN");
      notice.readAt ??= s.now;
      break;
    }
    case "RETRY": {
      admin();
      const n = s.notices.find((n) => n.id === c.noticeId);
      requireRule(
        n && n.status === "FAILED",
        "รายการนี้ไม่อยู่ในสถานะส่งไม่สำเร็จ",
      );
      n.status = "QUEUED";
      log("นำการแจ้งเตือนกลับเข้าคิว");
      break;
    }
    case "CLOCK":
      requireRule(Number.isFinite(ms(c.now)), "วันเวลาไม่ถูกต้อง");
      requireRule(
        ms(c.now) >= ms(s.now),
        "เลื่อนเวลาเดโมไปข้างหน้าได้เท่านั้น ใช้เริ่มเดโมใหม่เพื่อย้อนเวลา",
      );
      s.now = c.now;
      break;
    case "RUN_JOBS": {
      s.notices
        .filter((n) => n.status === "QUEUED")
        .forEach((n) => {
          n.status = "SENT";
          n.attempts++;
        });
      advanceLifecycle(s, s.now);
      break;
    }
  }
  return s;
}
