import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createSeed } from '../../apps/web/src/lib/seed';
import { emptyData } from '../../apps/backend/src/infrastructure/store';
import { applyCommand } from '../../apps/backend/src/modules/booking-service';

test('a room with active bookings accepts a photo update despite JSON key/weekday ordering, but rejects changed hours', () => {
  const data = emptyData(); data.state = createSeed();
  const room = data.state.rooms[0];
  // JSONB returns keys in a different order than the API validation schema.
  room.hours = { end: '20:00', leadMinutes: 0, start: '08:00', weekdays: [6, 5, 4, 3, 2, 1, 0] };
  const bookings = structuredClone(data.state.bookings);
  const update = { ...room, imageUrl: '/room-images/building-sc09.jpg', hours: { start: '08:00', end: '20:00', weekdays: [0, 1, 2, 3, 4, 5, 6], leadMinutes: 0 } };
  applyCommand(data, 3, { type: 'ROOM_SAVE', room: update }, randomUUID(), data.state.now);
  assert.equal(data.state.rooms.find(r => r.id === room.id)?.imageUrl, update.imageUrl);
  assert.deepEqual(data.state.bookings, bookings);
  for (const hours of [{ ...update.hours, end: '19:00' }, { ...update.hours, weekdays: [1, 2, 3, 4, 5] }, undefined]) {
    assert.throws(() => applyCommand(data, 3, { type: 'ROOM_SAVE', room: { ...update, hours } }, randomUUID(), data.state.now));
  }
});
