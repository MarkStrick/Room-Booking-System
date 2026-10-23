import assert from 'node:assert/strict';
import { access, mkdir, readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { readConfig } from '../apps/backend/src/common/config';
import { createStore } from '../apps/backend/src/infrastructure/create-store';
import { computingCatalog } from '../packages/core/src/space-scope';
import { syncComputingCatalog, type ComputingCatalog } from './lib/sync-computing-catalog';

const catalog = JSON.parse(await readFile(new URL('../docs/data/computing-rooms-2026-10-15.json', import.meta.url), 'utf8')) as ComputingCatalog;
const photos = JSON.parse(await readFile(new URL('../docs/data/computing-room-photos.json', import.meta.url), 'utf8')) as { images: { roomCode?: string; externalBuildingId?: number; imageUrl: string }[] };
for (const entry of catalog.rooms) {
  const photo = photos.images.find(p => p.roomCode === entry.code) ?? photos.images.find(p => !p.roomCode && p.externalBuildingId === entry.externalBuildingId);
  assert.ok(photo && /^\/room-images\/[a-z0-9-]+\.(png|jpg)$/.test(photo.imageUrl), `Missing verified photo for ${entry.code}`);
  await access(new URL('../apps/web/public' + photo.imageUrl, import.meta.url));
  entry.imageUrl = photo.imageUrl;
}
const store = await createStore(readConfig());
try {
  const before = await store.read();
  const admin = before.state.users.find(u => u.email === 'kittiphon.su@kkumail.com' && u.active && u.role === 'ADMIN');
  if (!admin) throw new Error('The configured import administrator must be active');
  const now = new Date().toISOString();
  const preview = syncComputingCatalog(structuredClone(before), catalog, admin.id, now);
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'preview', ...preview }, null, 2));
  } else {
    await mkdir('tmp/backups', { recursive: true });
    const backup = `tmp/backups/pre-computing-catalog-${now.replace(/[:.]/g, '-')}.json`;
    const result = await store.transaction(data => {
      // Capture the locked transaction's catalog, including references, before any edits.
      // Private account/session rows are deliberately excluded from this backup.
      const snapshot = { createdAt: now, buildings: data.state.buildings, rooms: data.state.rooms, bookings: data.state.bookings, assignments: data.state.assignments };
      writeFileSync(backup, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
      return syncComputingCatalog(data, catalog, admin.id, now);
    });
    const after = (await store.read()).state;
    for (const entry of catalog.rooms) {
      const room = after.rooms.find(r => r.code === entry.code);
      assert.ok(room && room.active !== false);
      const building = catalog.buildings.find(b => b.externalId === entry.externalBuildingId)!;
      assert.equal(after.buildings.find(b => b.id === room.buildingId)?.name, building.name);
      for (const key of ['name', 'floor', 'capacity', 'type', 'amenities'] as const) assert.deepEqual(room[key], entry[key]);
    }
    // The import must never rewrite booking identities or ownership.
    for (const booking of before.state.bookings) assert.deepEqual(after.bookings.find(b => b.id === booking.id), booking);
    assert.equal(computingCatalog(after).rooms.length, catalog.rooms.length);
    console.log(JSON.stringify({ mode: 'applied', ...result, verifiedRooms: catalog.rooms.length, visibleBuildings: computingCatalog(after).buildings.length, backup }, null, 2));
  }
} finally {
  await store.close();
}
