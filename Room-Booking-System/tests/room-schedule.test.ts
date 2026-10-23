import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../apps/web/src/lib/seed';
import { stamp } from '../packages/core/src/domain';
import { roomScheduleEvents, scheduleFreeSlots, scheduleHours, scheduleSlotIssue, scheduleDates, scheduleNavigate, scheduleDisplayHours } from '../apps/web/src/lib/room-schedule';

const date = '2026-10-15';

test('week and month views start on Monday and month navigation clamps short months', () => {
  assert.deepEqual(scheduleDates(date, 'week'), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  const month = scheduleDates(date, 'month');
  assert.equal(month.length, 42);
  assert.equal(month[0], '2026-09-28');
  assert.equal(month.at(-1), '2026-11-08');
  assert.equal(scheduleNavigate('2026-01-31', 'month', 1), '2026-02-28');
  assert.equal(scheduleNavigate('2028-01-31', 'month', 1), '2028-02-29');
  assert.equal(scheduleNavigate('2026-01-01', 'week', -1), '2025-12-25');
});

test('unconfigured rooms still show a calendar without inventing bookable hours', () => {
  const { state, room } = fixture();
  room.hours = undefined;
  assert.deepEqual(scheduleDisplayHours(state, [room.id], [date]), { startHour: 8, endHour: 20, cellDuration: 30 });
  assert.ok(scheduleSlotIssue(state, room.id, date, '09:00', '09:30'));
  assert.deepEqual(scheduleFreeSlots(state, room.id, date), []);
  room.hours = { start: '07:15', end: '21:15', weekdays: [4], leadMinutes: 0 };
  assert.deepEqual(scheduleDisplayHours(state, [room.id], scheduleDates(date, 'week')), { startHour: 7.25, endHour: 21.25, cellDuration: 15 });
});
function fixture() {
  const state = createSeed();
  state.now = stamp(date, '07:00');
  state.bookings = [];
  state.closures = [];
  state.holidays = [];
  const room = state.rooms[0];
  room.status = 'AVAILABLE';
  room.hours = { start: '08:30', end: '16:30', weekdays: [0, 1, 2, 3, 4, 5, 6], leadMinutes: 0 };
  return { state, room };
}

test('schedule renders Bangkok time without exposing booking details and skips other rooms/cancelled bookings', () => {
  const { state, room } = fixture();
  const booking = { id: 1, ref: 'private-reference', userId: 1, roomId: room.id,
    start: '2026-10-15T02:00:00Z', end: '2026-10-15T03:00:00Z', status: 'PENDING' as const,
    purpose: 'private-purpose', participantEmails: ['private@example.com'], attendees: 2, participants: [], equipment: [], createdAt: state.now };
  state.bookings.push(booking, { ...booking, id: 2, status: 'CANCELLED' }, { ...booking, id: 3, roomId: 999 });
  const events = roomScheduleEvents(state, [room.id], date);
  assert.equal(events.length, 1);
  assert.equal(events[0].start, '2026-10-15T09:00:00');
  assert.equal(events[0].text, 'รออนุมัติ');
  assert.ok(!JSON.stringify(events).includes('private'));
  assert.deepEqual(roomScheduleEvents(state, [room.id], '2026-10-16'), []);
});

test('free slots respect pending reservations, adjacent endpoints and closures', () => {
  const { state, room } = fixture();
  state.bookings.push({ id: 1, ref: '', userId: 1, roomId: room.id, start: stamp(date, '09:00'), end: stamp(date, '10:00'),
    status: 'PENDING', purpose: '', attendees: 1, participants: [], equipment: [], createdAt: state.now });
  state.closures.push({ id: 1, roomId: room.id, start: stamp(date, '11:00'), end: stamp(date, '12:00'), reason: 'maintenance' });
  const starts = scheduleFreeSlots(state, room.id, date).map(slot => slot.start);
  assert.ok(starts.includes('08:30'));
  assert.ok(starts.includes('10:00'));
  assert.ok(!starts.includes('09:30'));
  assert.ok(!starts.includes('11:30'));
  assert.ok(!starts.includes('16:30'));
  assert.equal(roomScheduleEvents(state, [room.id], date).at(-1)?.text, 'ปิดชั่วคราว');
  assert.notEqual(scheduleSlotIssue(state, room.id, date, '08:30', '10:30'), '');
});

test('holidays, past slots, lead time, missing hours and closed rooms cannot be booked', () => {
  const { state, room } = fixture();
  state.holidays = [date];
  assert.deepEqual(scheduleFreeSlots(state, room.id, date), []);
  state.holidays = [];
  state.now = stamp(date, '09:00');
  assert.notEqual(scheduleSlotIssue(state, room.id, date, '08:30', '09:00'), '');
  room.hours!.leadMinutes = 120;
  assert.notEqual(scheduleSlotIssue(state, room.id, date, '10:00', '10:30'), '');
  assert.equal(scheduleSlotIssue(state, room.id, date, '11:00', '11:30'), '');
  room.status = 'MAINTENANCE';
  assert.deepEqual(scheduleFreeSlots(state, room.id, date), []);
  room.hours = undefined;
  assert.notEqual(scheduleSlotIssue(state, room.id, date, '11:00', '11:30'), '');
});

test('calendar range follows displayed rooms, preserving half-hour and quarter-hour boundaries', () => {
  const { state, room } = fixture();
  const second = { ...room, id: 900, hours: { ...room.hours!, start: '09:00', end: '18:00' } };
  state.rooms.push(second);
  assert.deepEqual(scheduleHours(state, [room.id], date), { startHour: 8.5, endHour: 16.5, start: '08:30', end: '16:30', cellDuration: 30 });
  assert.equal(scheduleHours(state, [room.id, second.id], date)?.end, '18:00');
  assert.equal(scheduleHours(state, [second.id], date)?.start, '09:00');
  room.hours!.start = '08:15';
  assert.equal(scheduleHours(state, [room.id], date)?.startHour, 8.25);
  assert.equal(scheduleHours(state, [room.id], date)?.cellDuration, 15);
});

test('free slots include thirty-minute intervals at exact opening and reservation boundaries', () => {
  const { state, room } = fixture();
  room.hours!.start = '08:15';
  room.hours!.end = '16:15';
  state.closures.push({ id: 1, roomId: room.id, start: stamp(date, '10:00'), end: stamp(date, '11:15'), reason: 'maintenance' });
  const slots = scheduleFreeSlots(state, room.id, date);
  assert.ok(slots.some(s => s.start === '08:15' && s.end === '08:45'));
  assert.ok(slots.some(s => s.start === '11:15' && s.end === '11:45'));
  assert.ok(slots.some(s => s.start === '15:45' && s.end === '16:15'));
  assert.ok(!slots.some(s => s.start === '10:00'));
});

test('calendar omits days without opening hours and handles overnight hours on the correct weekday', () => {
  const { state, room } = fixture();
  assert.equal(scheduleHours(state, [], date), null);
  state.holidays = [date];
  assert.equal(scheduleHours(state, [room.id], date), null);
  state.holidays = [];
  room.hours!.weekdays = [5];
  assert.equal(scheduleHours(state, [room.id], date), null);
  room.hours = { start: '22:00', end: '02:00', weekdays: [4], leadMinutes: 0 };
  assert.equal(scheduleHours(state, [room.id], date)?.start, '22:00');
  assert.equal(scheduleHours(state, [room.id], date)?.end, '24:00');
  assert.equal(scheduleHours(state, [room.id], '2026-10-16')?.start, '00:00');
  assert.equal(scheduleHours(state, [room.id], '2026-10-16')?.end, '02:00');
  room.hours = undefined;
  assert.equal(scheduleHours(state, [room.id], date), null);
});
