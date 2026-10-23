import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyData } from '../../apps/backend/src/infrastructure/store';
import { createSeed } from '../../apps/web/src/lib/seed';
import { syncComputingCatalog, type ComputingCatalog } from '../../scripts/lib/sync-computing-catalog';
import { computingCatalog } from '../../packages/core/src/space-scope';
import { SqliteStore } from '../../apps/backend/src/infrastructure/sqlite-store';

const catalog = JSON.parse(readFileSync(new URL('../../docs/data/computing-rooms-2026-10-15.json', import.meta.url), 'utf8')) as ComputingCatalog;
const now = '2026-10-15T06:00:00Z';

test('imports both buildings and all real rooms; rerunning preserves IDs and local settings', () => {
  const data = emptyData(); data.state = createSeed();
  data.state.rooms = []; data.state.buildings = []; data.state.bookings = [];
  const first = syncComputingCatalog(data, catalog, 3, now);
  assert.equal(first.added.length, 28);
  assert.equal(computingCatalog(data.state).rooms.length, 28);
  assert.deepEqual(data.state.buildings.map(b => b.floors), [6, 6]);
  assert.ok(data.state.buildings.every(b => b.levels?.length === 6));
  const room = data.state.rooms.find(r => r.code === '9227')!;
  assert.equal(room.capacity, 50); // Computers (54) are not the room capacity.
  assert.ok(room.amenities.includes('คอม 54 เครื่อง'));
  assert.deepEqual(room.hours, { start: '08:00', end: '20:00', weekdays: [0, 1, 2, 3, 4, 5, 6], leadMinutes: 0 });
  room.status = 'MAINTENANCE'; room.reason = 'ซ่อม';
  room.hours = { start: '09:00', end: '17:00', weekdays: [1, 2, 3, 4, 5], leadMinutes: 60 };
  const snapshot = structuredClone(data);
  assert.equal(syncComputingCatalog(data, catalog, 3, now).added.length, 0);
  assert.deepEqual(data, snapshot);
  const revised = structuredClone(catalog);
  revised.rooms.find(r => r.code === '9227')!.capacity = 48;
  revised.rooms.find(r => r.code === '9227')!.imageUrl = '/room-images/building-sc09.jpg';
  assert.deepEqual(syncComputingCatalog(data, revised, 3, now).updated, ['9227']);
  assert.equal(data.state.rooms.find(r => r.id === room.id)?.capacity, 48);
  assert.equal(data.state.rooms.find(r => r.id === room.id)?.status, 'MAINTENANCE');
  assert.equal(data.state.rooms.find(r => r.id === room.id)?.imageUrl, '/room-images/building-sc09.jpg');
  assert.deepEqual(data.state.rooms.find(r => r.id === room.id)?.hours, room.hours);
});

test('retires legacy fixtures while preserving pending bookings and unrelated rooms', () => {
  const data = emptyData(); data.state = createSeed();
  data.state.rooms = data.state.rooms.slice(0, 3).map((r, i) => ({ ...r, code: `DEMO-S0${i + 1}` }));
  data.state.bookings = data.state.bookings.filter(b => b.roomId === 1);
  data.state.rooms.push({ ...data.state.rooms[0], id: 99, code: 'CUSTOM-1' });
  const bookings = structuredClone(data.state.bookings);
  const result = syncComputingCatalog(data, catalog, 3, now);
  assert.deepEqual(result.retainedForBookings, ['DEMO-S01']);
  assert.deepEqual(result.archived, ['DEMO-S02', 'DEMO-S03']);
  assert.equal(data.state.rooms.find(r => r.id === 99)?.active, undefined);
  assert.deepEqual(data.state.bookings, bookings);
  assert.ok(data.state.rooms.find(r => r.id === 1)?.active !== false);
});

test('adopts existing building and room identities; capacity conflicts roll back the import', async () => {
  const data = emptyData(); data.state = createSeed();
  data.state.buildings[0].name = 'อาคารวิทยวิภาส';
  data.state.rooms[0].code = '9126-6';
  data.state.rooms[0].name = 'ชื่อเก่า';
  data.state.rooms[0].capacity = 100;
  data.state.rooms[0].hours = { start: '08:00', end: '20:00', weekdays: [0, 1, 2, 3, 4, 5, 6], leadMinutes: 0 };
  const before = structuredClone(data);
  const conflicting = data.state.bookings.find(b => b.roomId === 1 && b.status === 'APPROVED')!;
  conflicting.attendees = 25;
  const store = new SqliteStore(':memory:', data);
  try {
    const snapshot = await store.read();
    await assert.rejects(store.transaction(current => syncComputingCatalog(current, catalog, 3, now)));
    assert.deepEqual(await store.read(), snapshot);
  } finally {
    await store.close();
  }
  assert.equal(data.state.rooms[0].name, 'ชื่อเก่า');
  conflicting.attendees = 4;
  const result = syncComputingCatalog(data, catalog, 3, now);
  assert.ok(result.updated.includes('9126-6'));
  const room = data.state.rooms.find(r => r.code === '9126-6')!;
  assert.equal(room.id, before.state.rooms[0].id);
  assert.equal(room.buildingId, before.state.buildings[0].id);
  assert.equal(room.floor, 1);
  assert.equal(room.capacity, 20);
});

test('refuses a partial HAR catalog before changing existing data', () => {
  const data = emptyData(); data.state = createSeed();
  const before = structuredClone(data);
  assert.throws(() => syncComputingCatalog(data, { ...catalog, buildings: catalog.buildings.slice(0, 1) }, 3, now));
  assert.deepEqual(data, before);
});
