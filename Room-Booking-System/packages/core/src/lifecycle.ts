import type { AppState, Booking } from "../../contracts/src/index";
import { canManage, dateOf, ms, thaiDate, time } from "./domain";
const nextId = (rows: { id: number }[]) =>
  Math.max(0, ...rows.map((r) => r.id)) + 1;
export function bookingSummary(s: AppState, b: Booking) {
  const room = s.rooms.find((r) => r.id === b.roomId);
  return `${b.ref} • ${room?.name ?? "ห้อง"} (${room?.code ?? ""}) • ${thaiDate(b.start)} ${time(b.start)}–${dateOf(b.start)!==dateOf(b.end)?thaiDate(b.end)+' ':''}${time(b.end)} น. (เวลาประเทศไทย)`;
}
export function releaseReservation(s: AppState, b: Booking) {
  for (const item of b.equipment) {
    const e = s.equipment.find((e) => e.id === item.id);
    if (e)
      e.remaining = Math.min(
        e.total,
        e.remaining + item.qty - (item.issued ?? 0),
      );
  }
}
export function advanceLifecycle(s: AppState, now: string) {
  s.now = now;
  const notify = (
    userId: number,
    b: Booking,
    subject: string,
    reason: string,
  ) =>
    s.notices.unshift({
      id: nextId(s.notices),
      userId,
      bookingId: b.id,
      subject,
      content: `${bookingSummary(s, b)}\n${reason}`,
      status: "QUEUED",
      createdAt: now,
      attempts: 0,
    });
  const log = (b: Booking, text: string) =>
    s.audit.unshift({
      id: nextId(s.audit),
      actorId: null,
      actionType:`SYSTEM_${b.status}`,
      bookingId: b.id,
      at: now,
      text: `${text} ${b.ref}`,
    });
  for (const b of s.bookings) {
    b.approvalDeadline ??= new Date(
      ms(b.createdAt) + 4 * 3600000,
    ).toISOString();
    if (b.status === "PENDING") {
      if (ms(now) >= ms(b.start)) {
        b.status = "CANCELLED";
        b.reason = "หมดเวลารออนุมัติเมื่อถึงเวลาเริ่ม";
        releaseReservation(s, b);
        log(b, b.reason);
        notify(
          b.userId,
          b,
          "คำขอหมดเวลารออนุมัติ",
          b.reason + " ไม่มีการบันทึกความผิด",
        );
      } else {
        if (
          !b.slaReminderAt &&
          ms(now) >= ms(b.approvalDeadline) - 30 * 60000
        ) {
          s.users
            .filter((u) => u.active && canManage(s, u, b.roomId))
            .forEach((u) =>
              notify(
                u.id,
                b,
                "ใกล้ครบกำหนดพิจารณา",
                "กรุณาพิจารณาคำขอภายใน " +
                  new Date(b.approvalDeadline!).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                  }),
              ),
            );
          b.slaReminderAt = now;
          log(b, "แจ้งเตือนก่อนครบ SLA");
        }
        if (!b.slaEscalatedAt && ms(now) >= ms(b.approvalDeadline)) {
          s.users
            .filter((u) => u.active && canManage(s, u, b.roomId))
            .forEach((u) =>
              notify(
                u.id,
                b,
                "คำขอเกินกำหนดพิจารณา 4 ชั่วโมง",
                "คำขอยังรอการตัดสินจากเจ้าหน้าที่",
              ),
            );
          b.slaEscalatedAt = now;
          log(b, "แจ้งเกินกำหนด SLA");
        }
      }
    } else if (
      b.status === "APPROVED" &&
      (ms(now) > ms(b.start) + 1800000 || ms(now) >= ms(b.end))
    ) {
      b.status = "NO_SHOW";
      releaseReservation(s, b);
      if (
        !s.violations.some((v) => v.bookingId === b.id && v.type === "NO_SHOW")
      )
        s.violations.push({
          id: nextId(s.violations),
          userId: b.userId,
          bookingId: b.id,
          type: "NO_SHOW",
          at: now,
        });
      log(b, "ไม่ได้เช็คอิน");
      notify(
        b.userId,
        b,
        "พ้นกำหนดเช็คอิน",
        "ไม่ได้เช็คอินภายใน 30 นาทีหลังเวลาเริ่ม บันทึกความผิด NO_SHOW",
      );
    } else if (b.status === "CHECKED_IN" && ms(now) >= ms(b.end)) {
      b.status = "COMPLETED";
      releaseReservation(s, b);
      log(b, "สิ้นสุดรอบ");
    }
    if (
      !["PENDING", "APPROVED", "CHECKED_IN"].includes(b.status) &&
      ms(b.end) < ms(now) - 30 * 86400000
    )
      b.archivedAt ??= now;
  }
}
