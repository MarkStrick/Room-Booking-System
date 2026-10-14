import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../apps/web/src/lib/seed';
import { bookingTimeOptions } from '../packages/core/src/booking-times';
import { stamp } from '../packages/core/src/domain';

function fixture() {
  const state = createSeed();
  state.now = stamp('2026-10-14', '07:00');
  state.bookings = [];
  state.closures = [];
  state.holidays = [];
  const room = state.rooms[0];
  room.hours = { start: '08:15', end: '17:15', weekdays: [1, 2, 3, 4, 5], leadMinutes: 0 };
  return { state, room };
}

test('offers only open times, including exact opening/closing boundaries and valid durations', () => {
  const { state, room } = fixture();
  const { starts, ends } = bookingTimeOptions(state, room, '2026-10-14', false, '16:30');
  assert.ok(starts.includes('08:15'));
  assert.ok(!starts.includes('08:00'));
  assert.ok(!starts.includes('17:00'));
  assert.deepEqual(ends, ['17:00', '17:15']);
  const early = bookingTimeOptions(state, room, '2026-10-14', false, '08:15');
  assert.ok(!early.ends.includes('08:30'));
  assert.ok(!early.ends.includes('12:30'));
});

test('blocks pending bookings and closures across whole interval; adjacent endpoints are allowed', () => {
  const { state, room } = fixture();
  state.bookings.push({ id: 1, ref: 'test', roomId: room.id, userId: 1,
    start: stamp('2026-10-14', '10:00'), end: stamp('2026-10-14', '11:15'),
    status: 'PENDING', purpose: 'test', attendees: 1, participants: [], equipment: [], createdAt: state.now });
  state.closures.push({ id: 1, roomId: room.id, start: stamp('2026-10-14', '13:00'), end: stamp('2026-10-14', '14:00'), reason: 'test' });
  const before = bookingTimeOptions(state, room, '2026-10-14', false, '09:00');
  assert.ok(before.ends.includes('10:00'));
  assert.ok(!before.ends.includes('12:00'));
  assert.ok(!before.starts.includes('10:00'));
  assert.ok(before.starts.includes('11:15'));
  assert.ok(!before.starts.includes('13:30'));
  assert.ok(before.starts.includes('14:00'));
  state.bookings[0].status = 'CANCELLED';
  assert.ok(bookingTimeOptions(state, room, '2026-10-14', false).starts.includes('10:00'));
});

test('respects holidays, weekdays, advance limit, lead time, and closed rooms', () => {
  const { state, room } = fixture();
  assert.deepEqual(bookingTimeOptions(state, room, '', true), { starts: [], ends: [] });
  assert.deepEqual(bookingTimeOptions(state, room, '2026-02-30', true), { starts: [], ends: [] });
  assert.deepEqual(bookingTimeOptions(state, room, '2026-10-18', false).starts, []);
  assert.deepEqual(bookingTimeOptions(state, room, '2026-11-04', false).starts, []);
  state.holidays = ['2026-10-14'];
  assert.deepEqual(bookingTimeOptions(state, room, '2026-10-14', false).starts, []);
  state.holidays = [];
  state.now = stamp('2026-10-14', '09:00');
  room.hours!.leadMinutes = 60;
  const slots = bookingTimeOptions(state, room, '2026-10-14', false);
  assert.ok(!slots.starts.includes('09:30'));
  assert.ok(slots.starts.includes('10:00'));
  room.status = 'MAINTENANCE';
  assert.deepEqual(bookingTimeOptions(state, room, '2026-10-14', false).starts, []);
});

test('handles overnight opening windows and midnight end on a holiday', () => {
  const { state, room } = fixture();
  room.hours = { start: '22:00', end: '02:00', weekdays: [3], leadMinutes: 0 };
  const overnight = bookingTimeOptions(state, room, '2026-10-14', true, '23:00');
  assert.deepEqual(overnight.ends, ['00:00', '00:30', '01:00', '01:30', '02:00']);
  assert.ok(!overnight.starts.includes('21:30'));
  const morning = bookingTimeOptions(state, room, '2026-10-15', false, '00:30');
  assert.ok(morning.ends.includes('02:00'));
  state.holidays = ['2026-10-15'];
  assert.deepEqual(bookingTimeOptions(state, room, '2026-10-14', true, '23:00').ends, ['00:00']);
});
