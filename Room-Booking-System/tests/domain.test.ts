import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../apps/web/src/lib/seed";
import {
  executeCommand,
  availability,
  DomainError,
  RecordedRejection,
  stamp,
  suspended,
  violationCount,
} from "../apps/web/src/lib/domain";
import type { Command } from "../packages/contracts/src/index";

const request = (
  roomId = 1,
  start = "10:00",
  end = "12:00",
): Extract<Command, { type: "BOOK" }> => ({
  type: "BOOK",
  roomId,
  start: stamp("2026-10-09", start),
  end: stamp("2026-10-09", end),
  purpose: "ทบทวนบทเรียน",
  attendees: 4,
  participants: [4],
  equipment: [{ id: 1, qty: 2 }],
});
const errorCode = (code: string) => (e: unknown) =>
  e instanceof DomainError && e.code === code;

test("request → scoped approval → cancellation returns stock and queues notices", () => {
  const original = createSeed();
  let s = executeCommand(original, 1, request());
  const id = s.bookings[0].id;
  assert.equal(s.equipment.find((e) => e.id === 1)!.remaining, 2);
  assert.equal(original.equipment.find((e) => e.id === 1)!.remaining, 4);
  assert.deepEqual(
    s.notices
      .filter((n) => n.bookingId === id)
      .map((n) => n.userId)
      .sort(),
    [1, 2, 3],
  );
  s = executeCommand(s, 2, {
    type: "DECIDE",
    bookingId: id,
    approve: true,
    reason: "",
  });
  assert.equal(s.bookings[0].status, "APPROVED");
  s = executeCommand(s, 1, { type: "CANCEL", bookingId: id });
  assert.equal(s.bookings[0].status, "CANCELLED");
  assert.equal(s.equipment.find((e) => e.id === 1)!.remaining, 4);
  assert.equal(
    availability(s, s.rooms[0], request().start, request().end).kind,
    "available",
  );
  assert.throws(() => executeCommand(s, 1, { type: "CANCEL", bookingId: id }));
});

test("overlapping requests rejected; adjacent intervals accepted; failed stock transaction atomic", () => {
  let s = executeCommand(createSeed(), 1, request());
  assert.throws(
    () => executeCommand(s, 4, request(1, "11:00", "13:00")),
    errorCode("ROOM_TIME_CONFLICT"),
  );
  s = executeCommand(s, 4, {
    ...request(1, "12:00", "14:00"),
    participants: [1],
  });
  assert.equal(s.equipment.find((e) => e.id === 1)!.remaining, 0);
  const snapshot = structuredClone(s);
  const shortage = {
    ...request(4),
    equipment: [
      { id: 2, qty: 1 },
      { id: 1, qty: 1 },
    ],
  };
  assert.throws(
    () => executeCommand(s, 1, shortage),
    errorCode("EQUIPMENT_UNAVAILABLE"),
  );
  assert.deepEqual(s, snapshot);
});

test("owner and assigned room boundaries enforced", () => {
  const s = createSeed();
  assert.throws(
    () =>
      executeCommand(s, 2, {
        type: "DECIDE",
        bookingId: 2,
        approve: true,
        reason: "",
      }),
    errorCode("FORBIDDEN_ROOM_SCOPE"),
  );
  assert.throws(
    () => executeCommand(s, 4, { type: "CANCEL", bookingId: 2 }),
    errorCode("FORBIDDEN"),
  );
  assert.throws(
    () =>
      executeCommand(s, 1, {
        type: "BUILDING_SAVE",
        name: "อาคารใหม่",
        floors: 2,
      }),
    errorCode("FORBIDDEN"),
  );
  assert.throws(
    () => executeCommand(s, 1, { type: "CANCEL", bookingId: 1 }),
    errorCode("CANCELLATION_TOO_LATE"),
  );
  assert.equal(s.violations.length, 3); // Commands never mutate their input state.
});

test("late cancellation records one violation without cancelling or releasing equipment", () => {
  let s = executeCommand(createSeed(), 1, request());
  const bookingId = s.bookings[0].id;
  s.now = stamp("2026-10-09", "08:01");
  const original = structuredClone(s);
  function reject(state: typeof s) {
    try {
      executeCommand(state, 1, { type: "CANCEL", bookingId });
      assert.fail("Late cancellation must be rejected");
    } catch (e) {
      assert.ok(e instanceof RecordedRejection);
      assert.equal(e.code, "CANCELLATION_TOO_LATE");
      return e.state;
    }
  }
  s = reject(s);
  assert.deepEqual(original.bookings, s.bookings);
  assert.deepEqual(original.equipment, s.equipment);
  assert.deepEqual(original.notices, s.notices);
  assert.equal(s.violations.filter(v => v.bookingId === bookingId && v.type === "LATE_CANCEL").length, 1);
  assert.equal(violationCount(s, 1), 1);
  const auditCount = s.audit.length;
  s = reject(s);
  assert.equal(s.violations.filter(v => v.bookingId === bookingId).length, 1);
  assert.equal(s.audit.length, auditCount);
  assert.throws(() => executeCommand(s, 4, { type: "CANCEL", bookingId }), errorCode("FORBIDDEN"));
  const onTime = { ...original, now: stamp("2026-10-09", "08:00") };
  const cancelled = executeCommand(onTime, 1, { type: "CANCEL", bookingId });
  assert.equal(cancelled.bookings[0].status, "CANCELLED");
  assert.deepEqual(cancelled.violations, original.violations);
});

test("pending quota, room capacity, advance range and holiday enforced", () => {
  let s = executeCommand(createSeed(), 1, { ...request(), equipment: [] });
  s = executeCommand(s, 1, { ...request(4), equipment: [] });
  assert.throws(
    () => executeCommand(s, 1, { ...request(6), equipment: [] }),
    errorCode("PENDING_LIMIT_REACHED"),
  );
  assert.throws(() =>
    executeCommand(createSeed(), 1, { ...request(), attendees: 9 }),
  );
  assert.throws(() =>
    executeCommand(createSeed(), 1, {
      ...request(),
      start: stamp("2026-10-24", "10:00"),
      end: stamp("2026-10-24", "12:00"),
    }),
  );
  assert.throws(
    () =>
      executeCommand(createSeed(), 1, {
        ...request(),
        start: stamp("2026-10-13", "10:00"),
        end: stamp("2026-10-13", "12:00"),
      }),
    errorCode("ROOM_TIME_CONFLICT"),
  );
});

test("check-in and expiry jobs are idempotent; 30 minute boundary inclusive", () => {
  let s = executeCommand(createSeed(), 1, {
    type: "CLOCK",
    now: stamp("2026-10-08", "09:30"),
  });
  s = executeCommand(s, 1, { type: "CHECKIN", bookingId: 1 });
  s = executeCommand(s, 1, {
    type: "CLOCK",
    now: stamp("2026-10-08", "10:00"),
  });
  s = executeCommand(s, 1, { type: "RUN_JOBS" });
  assert.equal(s.bookings.find((b) => b.id === 1)!.status, "COMPLETED");
  assert.equal(s.violations.filter((v) => v.bookingId === 1).length, 0);
  let absent = executeCommand(createSeed(), 1, {
    type: "CLOCK",
    now: stamp("2026-10-08", "09:31"),
  });
  assert.throws(
    () => executeCommand(absent, 1, { type: "CHECKIN", bookingId: 1 }),
    errorCode("CHECKIN_WINDOW_CLOSED"),
  );
  absent = executeCommand(absent, 1, { type: "RUN_JOBS" });
  const count = absent.audit.length;
  absent = executeCommand(absent, 1, { type: "RUN_JOBS" });
  assert.equal(absent.bookings.find((b) => b.id === 1)!.status, "NO_SHOW");
  assert.equal(absent.violations.filter((v) => v.bookingId === 1).length, 1);
  assert.equal(absent.audit.length, count);
});

test("closure cancels overlapping bookings without penalizing the owner", () => {
  let s = executeCommand(createSeed(), 1, request());
  const before = s.violations.length;
  s = executeCommand(s, 3, {
    type: "CLOSE_ROOM",
    roomId: 1,
    start: stamp("2026-10-09", "09:00"),
    end: stamp("2026-10-09", "17:00"),
    reason: "ซ่อมแอร์",
  });
  assert.equal(s.bookings[0].status, "CANCELLED");
  assert.equal(s.equipment.find((e) => e.id === 1)!.remaining, 4);
  assert.equal(s.violations.length, before);
  assert.equal(
    availability(s, s.rooms[0], request().start, request().end).kind,
    "closed",
  );
  const inUse = executeCommand(createSeed(), 1, {
    type: "CHECKIN",
    bookingId: 1,
  });
  assert.throws(() =>
    executeCommand(inUse, 3, {
      type: "CLOSE_ROOM",
      roomId: 1,
      start: inUse.now,
      end: stamp("2026-10-08", "10:00"),
      reason: "ซ่อม",
    }),
  );
});

test("warning keeps booking rights; suspension blocks during its dates and expires", () => {
  const decision = {
    type: "PENALTY",
    userId: 4,
    start: "2026-10-08",
    end: "2026-10-15",
    reason: "ขาดการใช้งาน 3 ครั้ง",
  } as const;
  const warned = executeCommand(createSeed(), 3, {
    ...decision,
    penaltyType: "WARNING",
  });
  assert.equal(suspended(warned, 4), false);
  assert.equal(violationCount(warned, 4), 0);
  assert.doesNotThrow(() =>
    executeCommand(warned, 4, { ...request(), participants: [1] }),
  );
  let banned = executeCommand(createSeed(), 3, {
    ...decision,
    penaltyType: "SUSPENSION",
  });
  assert.equal(suspended(banned, 4), true);
  assert.throws(() => executeCommand(banned, 4, request()));
  banned = executeCommand(banned, 3, {
    type: "CLOCK",
    now: stamp("2026-10-16", "09:00"),
  });
  assert.equal(suspended(banned, 4), false);
});

test("equipment edits cannot discard allocations; rejected request releases them", () => {
  let s = executeCommand(createSeed(), 1, request());
  const id = s.bookings[0].id;
  assert.throws(() =>
    executeCommand(s, 3, {
      type: "EQUIPMENT_SAVE",
      id: 1,
      name: "โปรเจกเตอร์",
      total: 1,
    }),
  );
  s = executeCommand(s, 3, {
    type: "EQUIPMENT_SAVE",
    id: 1,
    name: "โปรเจกเตอร์",
    total: 5,
  });
  assert.equal(s.equipment.find((e) => e.id === 1)!.remaining, 3);
  s = executeCommand(s, 2, {
    type: "DECIDE",
    bookingId: id,
    approve: false,
    reason: "ไม่เหมาะสมกับการใช้งาน",
  });
  assert.equal(s.equipment.find((e) => e.id === 1)!.remaining, 5);
});

test("room capacity changes protect active bookings but allow equal capacity and completed history", () => {
  const seed = createSeed();
  seed.bookings = [];
  const pending = executeCommand(seed, 1, { ...request(), participants: [] });
  const room = pending.rooms.find(r => r.id === 1)!;
  for (const status of ["PENDING", "APPROVED", "CHECKED_IN"] as const) {
    const state = structuredClone(pending);
    state.bookings[0].status = status;
    const before = structuredClone(state);
    assert.throws(
      () => executeCommand(state, 3, { type: "ROOM_SAVE", room: { ...room, capacity: 3 } }),
      errorCode("ROOM_CAPACITY_CONFLICT"),
    );
    assert.deepEqual(state, before);
    const changed = executeCommand(state, 3, { type: "ROOM_SAVE", room: { ...room, capacity: 4 } });
    assert.equal(changed.rooms.find(r => r.id === 1)!.capacity, 4);
    assert.deepEqual(changed.bookings, state.bookings);
    assert.deepEqual(changed.equipment, state.equipment);
  }
  for (const status of ["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"] as const) {
    const state = structuredClone(pending);
    state.bookings[0].status = status;
    const changed = executeCommand(state, 3, { type: "ROOM_SAVE", room: { ...room, capacity: 3 } });
    assert.equal(changed.rooms.find(r => r.id === 1)!.capacity, 3);
    assert.deepEqual(changed.bookings, state.bookings);
  }
  const otherRoom = pending.rooms.find(r => r.id === 3)!;
  assert.doesNotThrow(() => executeCommand(pending, 3, { type: "ROOM_SAVE", room: { ...otherRoom, capacity: 1 } }));
});

test("approval rechecks current capacity and leaves over-capacity requests available for rejection", () => {
  const seed = createSeed();
  seed.bookings = [];
  const pending = executeCommand(seed, 1, { ...request(), participants: [] });
  const bookingId = pending.bookings[0].id;
  // Older data or external maintenance may already have an inconsistent capacity.
  pending.rooms.find(r => r.id === 1)!.capacity = 3;
  const before = structuredClone(pending);
  assert.throws(
    () => executeCommand(pending, 2, { type: "DECIDE", bookingId, approve: true, reason: "" }),
    errorCode("ROOM_CAPACITY_EXCEEDED"),
  );
  assert.deepEqual(pending, before);
  const rejected = executeCommand(pending, 2, { type: "DECIDE", bookingId, approve: false, reason: "จำนวนคนเกินความจุปัจจุบัน" });
  assert.equal(rejected.bookings[0].status, "REJECTED");
  assert.equal(rejected.equipment.find(e => e.id === 1)!.remaining, seed.equipment.find(e => e.id === 1)!.remaining);
  const fitting = structuredClone(pending);
  fitting.rooms.find(r => r.id === 1)!.capacity = 4;
  assert.equal(executeCommand(fitting, 2, { type: "DECIDE", bookingId, approve: true, reason: "" }).bookings[0].status, "APPROVED");
});
test("holiday CRUD validates dates and permissions, and controls booking availability", () => {
  let s = createSeed();
  s.bookings = [];
  const save = { type: "HOLIDAY_SAVE", date: "2026-10-10" } as const;
  for (const actor of [1, 2]) assert.throws(() => executeCommand(s, actor, save));
  for (const date of ["2026-02-29", "2026-04-31", "2026-1-10", "invalid", ""]) {
    assert.throws(() => executeCommand(s, 3, { ...save, date }), errorCode("INVALID_HOLIDAY_DATE"));
  }
  s = executeCommand(s, 3, save);
  assert.ok(s.holidays.includes(save.date));
  assert.throws(() => executeCommand(s, 3, save), errorCode("HOLIDAY_DUPLICATE"));
  const booking = { ...request(), start: stamp(save.date, "10:00"), end: stamp(save.date, "12:00") };
  assert.equal(availability(s, s.rooms[0], booking.start, booking.end).kind, "closed");
  assert.throws(() => executeCommand(s, 1, booking));
  for (const actor of [1, 2]) assert.throws(() => executeCommand(s, actor, { type: "HOLIDAY_DELETE", date: save.date }));
  const updated = executeCommand(s, 3, { ...save, previousDate: save.date, date: "2026-10-11" });
  assert.ok(!updated.holidays.includes(save.date));
  assert.ok(updated.holidays.includes("2026-10-11"));
  assert.throws(() => executeCommand(updated, 3, { ...save, previousDate: save.date }), errorCode("HOLIDAY_NOT_FOUND"));
  s = executeCommand(s, 3, { type: "HOLIDAY_DELETE", date: save.date });
  assert.doesNotThrow(() => executeCommand(s, 1, booking));
  assert.throws(() => executeCommand(s, 3, { type: "HOLIDAY_DELETE", date: save.date }), errorCode("HOLIDAY_NOT_FOUND"));
  assert.doesNotThrow(() => executeCommand(s, 3, { ...save, date: "2028-02-29" }));
  assert.ok(s.audit.some(a => JSON.stringify(a).includes("ลบวันหยุด")));
});

test("holiday additions and edits preserve active bookings and reject conflicts atomically", () => {
  const seed = createSeed(); seed.bookings = [];
  const pending = executeCommand(seed, 1, request());
  for (const status of ["PENDING", "APPROVED", "CHECKED_IN"] as const) {
    const state = structuredClone(pending); state.bookings[0].status = status;
    const before = structuredClone(state);
    for (const previousDate of [undefined, "2026-10-13"]) {
      assert.throws(() => executeCommand(state, 3, { type: "HOLIDAY_SAVE", date: "2026-10-09", previousDate }), errorCode("HOLIDAY_BOOKING_CONFLICT"));
      assert.deepEqual(state, before);
    }
  }
  for (const status of ["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"] as const) {
    const state = structuredClone(pending); state.bookings[0].status = status;
    const changed = executeCommand(state, 3, { type: "HOLIDAY_SAVE", date: "2026-10-09" });
    assert.deepEqual(changed.bookings, state.bookings);
    assert.deepEqual(changed.equipment, state.equipment);
  }
  const stale = structuredClone(pending); stale.holidays.push("2026-10-09");
  assert.throws(() => executeCommand(stale, 2, { type: "DECIDE", bookingId: stale.bookings[0].id, approve: true, reason: "" }));
});
