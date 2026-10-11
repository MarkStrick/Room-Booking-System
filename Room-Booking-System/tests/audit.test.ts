import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../apps/web/src/lib/seed";
import {
  executeCommand,
  stamp,
  searchRooms,
  canManage,
  availability,
} from "../packages/core/src/domain";
import { advanceLifecycle } from "../packages/core/src/lifecycle";
import { reportData, encodeCsv } from "../packages/core/src/reporting";
import { projectState } from "../apps/backend/src/common/projection";
const seed = () => {
  const s = createSeed();
  s.bookings = [];
  s.violations = [];
  s.penalties = [];
  s.notices = [];
  s.audit = [];
  s.inspections = [];
  s.now = stamp("2026-10-08", "09:00");
  return s;
};
const book = {
  type: "BOOK",
  roomId: 1,
  start: stamp("2026-10-09", "10:00"),
  end: stamp("2026-10-09", "12:00"),
  purpose: "test audit",
  attendees: 4,
  participants: [],
  equipment: [{ id: 1, qty: 2 }],
} as const;
const pending = () =>
  executeCommand(seed(), 1, {
    ...book,
    participants: [],
    equipment: [...book.equipment],
  });
test("SLA notifications respect boundaries, scope and dedupe; pending expires at start without penalty", () => {
  const s = pending(),
    initial = s.notices.length;
  advanceLifecycle(s, stamp("2026-10-08", "12:29"));
  assert.equal(s.notices.length, initial);
  advanceLifecycle(s, stamp("2026-10-08", "12:30"));
  const reminders = s.notices.filter(
    (n) => n.subject === "ใกล้ครบกำหนดพิจารณา",
  );
  assert.deepEqual(reminders.map((n) => n.userId).sort(), [2, 3]);
  advanceLifecycle(s, stamp("2026-10-08", "13:00"));
  const count = s.notices.length;
  assert.equal(
    s.notices.filter((n) => n.subject.includes("เกินกำหนด")).length,
    2,
  );
  advanceLifecycle(s, stamp("2026-10-08", "13:05"));
  assert.equal(s.notices.length, count);
  assert.equal(s.bookings[0].status, "PENDING");
  advanceLifecycle(s, book.start);
  assert.equal(s.bookings[0].status, "CANCELLED");
  assert.equal(s.violations.length, 0);
  assert.equal(s.equipment[0].remaining, seed().equipment[0].remaining);
  const after = structuredClone(s);
  advanceLifecycle(s, book.start);
  assert.deepEqual(s, after);
});
test("issued equipment stays held after completion, supports partial returns and rejects double returns", () => {
  let s = pending();
  s = executeCommand(s, 2, {
    type: "DECIDE",
    bookingId: s.bookings[0].id,
    approve: true,
    reason: "",
  });
  s.now = book.start;
  s = executeCommand(s, 1, { type: "CHECKIN", bookingId: s.bookings[0].id });
  const id = s.bookings[0].id,
    held = s.equipment[0].remaining;
  assert.throws(() =>
    executeCommand(s, 1, {
      type: "EQUIPMENT_HANDOVER",
      bookingId: id,
      equipmentId: 1,
      qty: 1,
      action: "ISSUE",
    }),
  );
  s = executeCommand(s, 2, {
    type: "EQUIPMENT_HANDOVER",
    bookingId: id,
    equipmentId: 1,
    qty: 1,
    action: "ISSUE",
  });
  advanceLifecycle(s, book.end);
  assert.equal(s.equipment[0].remaining, held + 1);
  s = executeCommand(s, 2, {
    type: "EQUIPMENT_HANDOVER",
    bookingId: id,
    equipmentId: 1,
    qty: 1,
    action: "RETURN",
  });
  assert.equal(s.equipment[0].remaining, held + 2);
  assert.throws(() =>
    executeCommand(s, 2, {
      type: "EQUIPMENT_HANDOVER",
      bookingId: id,
      equipmentId: 1,
      qty: 1,
      action: "RETURN",
    }),
  );
});
test("inactive rooms/buildings disappear from search; deletes preserve references and old history", () => {
  const s = pending();
  assert.throws(() =>
    executeCommand(s, 3, { type: "ROOM_ACTIVE", roomId: 1, active: false }),
  );
  assert.throws(() =>
    executeCommand(s, 3, {
      type: "BUILDING_ACTIVE",
      buildingId: 1,
      active: false,
    }),
  );
  const cancelled = executeCommand(s, 1, {
    type: "CANCEL",
    bookingId: s.bookings[0].id,
  });
  const inactive = executeCommand(cancelled, 3, {
    type: "ROOM_ACTIVE",
    roomId: 1,
    active: false,
  });
  const filter = {
    date: "2026-10-09",
    start: "10:00",
    end: "12:00",
    building: "",
    capacity: 1,
    type: "",
    query: "",
    amenity: "",
  };
  assert.ok(!searchRooms(inactive, filter).some((r) => r.id === 1));
  assert.deepEqual(inactive.bookings, cancelled.bookings);
  assert.throws(() =>
    executeCommand(inactive, 3, { type: "ROOM_DELETE", roomId: 1 }),
  );
  assert.throws(() =>
    executeCommand(inactive, 3, { type: "BUILDING_DELETE", buildingId: 1 }),
  );
  assert.equal(
    executeCommand(inactive, 3, {
      type: "ROOM_ACTIVE",
      roomId: 1,
      active: true,
    }).rooms.find((r) => r.id === 1)!.active,
    true,
  );
});
test("room inventory inspection snapshots quantities and requires scoped complete validation", () => {
  let s = seed();
  const room = {
    ...s.rooms[0],
    inventory: [{ id: 1, name: "จอภาพ", total: 3, damaged: 0 }],
    imageUrl: "https://example.com/room.jpg",
  };
  s = executeCommand(s, 3, { type: "ROOM_SAVE", room });
  assert.throws(() =>
    executeCommand(s, 1, {
      type: "INSPECT",
      roomId: 1,
      condition: "พร้อมใช้งาน",
      note: "",
      items: [{ id: 1, damaged: 1 }],
    }),
  );
  assert.throws(() =>
    executeCommand(s, 2, {
      type: "INSPECT",
      roomId: 1,
      condition: "พร้อมใช้งาน",
      note: "",
      items: [],
    }),
  );
  assert.throws(() =>
    executeCommand(s, 2, {
      type: "INSPECT",
      roomId: 1,
      condition: "พร้อมใช้งาน",
      note: "",
      items: [{ id: 1, damaged: 4 }],
    }),
  );
  assert.throws(() =>
    executeCommand(s, 2, {
      type: "INSPECT",
      roomId: 1,
      condition: "พร้อมใช้งาน",
      note: "",
      items: [{ id: 1, damaged: 1 }],
    }),
  );
  s = executeCommand(s, 2, {
    type: "INSPECT",
    roomId: 1,
    condition: "พบอุปกรณ์ชำรุด",
    note: "ตรวจแล้ว",
    items: [{ id: 1, damaged: 1 }],
  });
  assert.equal(s.inspections[0].items![0].damaged, 1);
  assert.equal(s.rooms.find((r) => r.id === 1)!.inventory![0].damaged, 1);
  assert.throws(() =>
    executeCommand(s, 3, {
      type: "ROOM_SAVE",
      room: { ...room, imageUrl: "javascript:alert(1)" },
    }),
  );
});
test("participant emails enforce counts/uniqueness and remain private to authorized bookings", () => {
  const s = seed();
  const request = { ...book, participants: [], equipment: [] };
  for (const emails of [
    ["invalid"],
    [s.users.find((u) => u.id === 1)!.email],
    ["a@example.com", "A@example.com"],
    ["a@x.com", "b@x.com", "c@x.com", "d@x.com"],
  ])
    assert.throws(() =>
      executeCommand(s, 1, { ...request, participantEmails: emails }),
    );
  const booked = executeCommand(s, 1, {
    ...request,
    participantEmails: ["guest@example.com"],
  });
  assert.deepEqual(booked.bookings[0].participantEmails, ["guest@example.com"]);
  assert.equal(
    projectState(
      booked,
      booked.users.find((u) => u.id === 4)!,
    ).bookings[0].participantEmails,
    undefined,
  );
});
test("help uses editable FAQ, contact details and only reveals owned booking status", () => {
  let s = pending();
  s = executeCommand(s, 3, {
    type: "SETTINGS_SAVE",
    contactEmail: "desk@example.com",
    contactPhone: "043000000",
    faqs: [{ q: "ทดสอบ", a: "คำตอบใหม่", keys: ["ทดสอบ"] }],
  });
  assert.throws(() =>
    executeCommand(s, 1, {
      type: "SETTINGS_SAVE",
      contactEmail: "",
      contactPhone: "",
      faqs: [],
    }),
  );
  let reply = executeCommand(s, 1, { type: "HELP", question: "ทดสอบ" });
  assert.equal(reply.messages.at(-1)!.answer, "คำตอบใหม่");
  reply = executeCommand(s, 1, { type: "HELP", question: s.bookings[0].ref });
  assert.ok(reply.messages.at(-1)!.answer.includes("รออนุมัติ"));
  reply = executeCommand(s, 4, { type: "HELP", question: s.bookings[0].ref });
  assert.ok(reply.messages.at(-1)!.answer.includes("ไม่พบ"));
  reply = executeCommand(s, 1, {
    type: "SUPPORT_REQUEST",
    question: "ช่วยตรวจคำขอ",
  });
  assert.ok(
    reply.notices.some(
      (n) => n.userId === 3 && n.subject === "คำถามถึงผู้ดูแล",
    ),
  );
});
test("report hours clip to now, utilization subtracts closures and holidays, assets use actual inspection", () => {
  const s = pending();
  s.now = stamp("2026-10-09", "11:00");
  s.bookings[0].status = "CHECKED_IN";
  s.bookings[0].checkedInAt = stamp("2026-10-09", "10:15");
  s.rooms[0].hours = {
    start: "08:00",
    end: "17:00",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    leadMinutes: 0,
  };
  s.closures = [
    {
      id: 1,
      roomId: 1,
      start: stamp("2026-10-09", "08:00"),
      end: stamp("2026-10-09", "09:00"),
      reason: "test",
    },
  ];
  s.inspections = [
    {
      id: 1,
      roomId: 1,
      at: s.now,
      condition: "ชำรุด",
      note: "",
      actorId: 2,
      items: [{ id: 1, name: "จอ", total: 3, damaged: 1 }],
    },
  ];
  const report = reportData(s, [s.rooms[0]], "2026-10-09", "2026-10-09");
  assert.equal(report.hours, 0.75);
  assert.equal(report.utilization[0].openHours, 2);
  assert.equal(report.utilization[0].rate, 37.5);
  assert.equal(report.assets[0].damaged, 1);
  s.holidays.push("2026-10-09");
  assert.equal(
    reportData(s, [s.rooms[0]], "2026-10-09", "2026-10-09").utilization[0]
      .openHours,
    0,
  );
  assert.equal(
    reportData(s, [s.rooms[1]], "2026-10-09", "2026-10-09").utilization[0].rate,
    null,
  );
  assert.equal(reportData(s, [], "", "").valid, false);
  assert.ok(encodeCsv([[" =1+2", 'a"b']]).includes("' =1+2"));
});
test("hours, minimum lead and dated staff scope enforce rules without forcing defaults", () => {
  const s = seed(),
    room = s.rooms[0];
  room.hours = {
    start: "09:00",
    end: "17:00",
    weekdays: [1, 2, 3, 4, 5],
    leadMinutes: 240,
  };
  assert.equal(
    availability(
      s,
      room,
      stamp("2026-10-08", "10:00"),
      stamp("2026-10-08", "11:00"),
    ).kind,
    "closed",
  );
  assert.equal(availability(s, room, book.start, book.end).kind, "available");
  s.assignments[0].end = "2026-10-07";
  assert.equal(
    canManage(
      s,
      s.users.find((u) => u.id === 2)!,
      1,
    ),
    false,
  );
});
test("terminal history is archived after 30 days without deleting data or violations", () => {
  const s = pending();
  s.bookings[0].status = "CANCELLED";
  advanceLifecycle(s, stamp("2026-11-10", "12:00"));
  assert.ok(s.bookings[0].archivedAt);
  assert.equal(s.bookings.length, 1);
});
test("cancellation notice includes reference, room, original date/time, reason and correct recipient", () => {
  const s = pending(),
    cancelled = executeCommand(s, 1, {
      type: "CANCEL",
      bookingId: s.bookings[0].id,
    }),
    notice = cancelled.notices.find((n) => n.subject === "ยืนยันการยกเลิก")!;
  assert.equal(notice.userId, 1);
  for (const value of [
    s.bookings[0].ref,
    s.rooms[0].name,
    "10:00",
    "12:00",
    "ผู้จองยกเลิก",
  ])
    assert.ok(notice.content.includes(value));
});
