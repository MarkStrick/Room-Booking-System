import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../apps/web/src/lib/seed";
import {
  matchesRoom,
  matchesBooking,
  bookingDetailsError,
} from "../apps/web/src/reference/booking-filters";
import type { Booking } from "../apps/web/src/reference/types";

const room = createSeed().rooms[0];
const filters = {
  query: "",
  capacity: 0,
  type: "",
  amenity: "",
  buildingId: "",
};

test("room discovery matches names, codes and buildings without case or surrounding-space sensitivity", () => {
  for (const query of [
    room.name,
    room.code.toLowerCase(),
    "  college OF computing  ",
  ]) {
    assert.equal(
      matchesRoom(room, "College of Computing", { ...filters, query }),
      true,
    );
  }
  assert.equal(
    matchesRoom(room, "College of Computing", {
      ...filters,
      query: "no such room",
    }),
    false,
  );
});

test("room discovery combines capacity, building, type and equipment instead of ignoring individual filters", () => {
  const selected = {
    ...filters,
    capacity: room.capacity,
    buildingId: String(room.buildingId),
    type: room.type,
    amenity: room.amenities[0] ?? "",
  };
  assert.equal(matchesRoom(room, "", selected), true);
  for (const change of [
    { capacity: room.capacity + 1 },
    { buildingId: "not-this-building" },
    { type: "not-this-type" },
    { amenity: "not-this-equipment" },
  ]) {
    assert.equal(matchesRoom(room, "", { ...selected, ...change }), false);
  }
});

test("booking lookup covers identifiers and requester information including absent references", () => {
  const booking: Booking = {
    id: "1",
    ref: "BK-2569-0123",
    roomId: "1",
    roomName: "Meeting A",
    building: "SC.06",
    userId: "1",
    userName: "สมชาย",
    userEmail: "student@kku.ac.th",
    date: "2026-10-23",
    startTime: "09:00",
    endTime: "10:00",
    purpose: "ประชุม",
    participants: 4,
    status: "pending",
    createdAt: "2026-10-22T08:00:00Z",
    canManage: false,
  };
  for (const query of [
    "  bk-2569-0123 ",
    "meeting a",
    "SC.06",
    "สมชาย",
    "STUDENT@KKU.AC.TH",
    "",
  ])
    assert.equal(matchesBooking(booking, query), true);
  assert.equal(matchesBooking(booking, "different room"), false);
  assert.equal(
    matchesBooking({ ...booking, ref: undefined }, "undefined"),
    false,
  );
});

test("review requires a meaningful purpose and whole-number attendance within room capacity", () => {
  assert.notEqual(bookingDetailsError(" \n ", 4, 20), "");
  for (const people of [0, -1, 1.5, 21, NaN, Infinity])
    assert.notEqual(bookingDetailsError("ประชุม", people, 20), "");
  assert.equal(bookingDetailsError("ประชุม", 1, 20), "");
  assert.equal(bookingDetailsError(" ประชุม ", 20, 20), "");
});
