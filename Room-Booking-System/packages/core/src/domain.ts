import type {
  AppState,
  Booking,
  BookingStatus,
  Command,
  Room,
  SearchFilter,
  User,
} from "../../contracts/src/index";

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
      (a) => a.userId === user.id && a.roomIds.includes(roomId),
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
  if (state.holidays.includes(dateOf(start)))
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
      content,
      bookingId,
      status: "QUEUED",
      createdAt: s.now,
      attempts: 0,
    });
  const release = (b: Booking) =>
    b.equipment.forEach((item) => {
      const e = s.equipment.find((e) => e.id === item.id);
      if (e) e.remaining = Math.min(e.total, e.remaining + item.qty);
    });
  const getBooking = (id: number) => {
    const b = s.bookings.find((b) => b.id === id);
    if (!b) throw new DomainError("NOT_FOUND", "ไม่พบรายการจอง");
    return b;
  };
  switch (c.type) {
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
        dateOf(c.start) === dateOf(c.end),
        "รองรับการจองภายในวันเดียวกัน",
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
      requireRule(
        new Set(c.equipment.map((e) => e.id)).size === c.equipment.length,
        "รายการอุปกรณ์ซ้ำ",
      );
      for (const item of c.equipment) {
        const e = s.equipment.find((e) => e.id === item.id);
        requireRule(
          e &&
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
        ref: `BK-${Number(dateOf(s.now).slice(0,4)) + 543}-${String(id).padStart(4, "0")}`,
        userId: actor.id,
        roomId: r.id,
        start: c.start,
        end: c.end,
        purpose: c.purpose.trim(),
        attendees: c.attendees,
        participants: c.participants,
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
      requireRule(
        ms(b.start) - ms(s.now) >= 2 * 3600000,
        "ต้องยกเลิกก่อนเริ่มอย่างน้อย 2 ชั่วโมง",
        "CANCELLATION_TOO_LATE",
      );
      b.status = "CANCELLED";
      b.reason = "ผู้จองยกเลิก";
      release(b);
      log(`ยกเลิก ${b.ref}`, b.id);
      notify(b.userId, "ยืนยันการยกเลิก", `${b.ref} ยกเลิกแล้ว`, b.id);
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
    case "INSPECT":
      requireRule(canManage(s, actor, c.roomId), "ไม่มีสิทธิ์ตรวจห้องนี้");
      s.inspections.unshift({
        id: nextId(s.inspections),
        roomId: c.roomId,
        at: s.now,
        condition: c.condition,
        note: c.note,
        actorId,
      });
      log("บันทึกผลตรวจห้อง");
      break;
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
        { id, name: c.name.trim(), floors: c.floors },
      ];
      log(`บันทึกอาคาร ${c.name}`);
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
        { id, name: c.name.trim(), total: c.total, remaining: c.total - held },
      ];
      log(`บันทึกอุปกรณ์ ${c.name}`);
      break;
    }
    case "PENALTY": {
      admin();
      requireRule(
        s.users.some((u) => u.id === c.userId && u.role === "USER") &&
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
    case "HELP": {
      requireRule(
        c.question.trim() && c.question.length <= 1000,
        "กรุณาระบุคำถามไม่เกิน 1,000 ตัวอักษร",
      );
      const faq = faqs.find((f) =>
        f.keys.some((k) => c.question.toLowerCase().includes(k)),
      );
      s.messages.push({
        id: nextId(s.messages),
        userId: actorId,
        question: c.question.trim(),
        answer:
          faq?.a ??
          "ยังไม่พบคำตอบใน FAQ ลองเลือกคำถามด้านซ้าย หรือสอบถามเจ้าหน้าที่ผู้ดูแลพื้นที่",
        at: s.now,
      });
      break;
    }
    case "READ_NOTICE": {
      const notice=s.notices.find(n=>n.id===c.noticeId&&n.userId===actor.id);
      requireRule(notice,'ไม่พบการแจ้งเตือนของคุณ','FORBIDDEN');
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
      s.bookings.forEach((b) => {
        if (
          b.status === "APPROVED" &&
          (ms(s.now) > ms(b.start) + 1800000 || ms(s.now) >= ms(b.end))
        ) {
          b.status = "NO_SHOW";
          release(b);
          if (
            !s.violations.some(
              (v) => v.bookingId === b.id && v.type === "NO_SHOW",
            )
          )
            s.violations.push({
              id: nextId(s.violations),
              userId: b.userId,
              bookingId: b.id,
              type: "NO_SHOW",
              at: s.now,
            });
          log(`ไม่ได้เช็คอิน ${b.ref}`, b.id, true);
          notify(
            b.userId,
            "พ้นกำหนดเช็คอิน",
            `${b.ref} บันทึกว่าไม่ได้เข้าใช้`,
            b.id,
          );
        } else if (b.status === "CHECKED_IN" && ms(s.now) >= ms(b.end)) {
          b.status = "COMPLETED";
          release(b);
          log(`สิ้นสุดรอบ ${b.ref}`, b.id, true);
        }
      });
      break;
    }
  }
  return s;
}

