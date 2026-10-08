import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../apps/web/src/lib/seed";
import {
  executeCommand,
  availability,
  DomainError,
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
  assert.equal(s.violations.length, 3); // Deferred late-cancel proposal must not add a violation.
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
