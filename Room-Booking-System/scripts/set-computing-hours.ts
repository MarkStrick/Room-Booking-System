// Owner-approved data migration: add previously missing hours without rewriting live bookings.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { readConfig } from '../apps/backend/src/common/config';
import { createStore } from '../apps/backend/src/infrastructure/create-store';
import { computingDefaultHours } from './lib/sync-computing-catalog';
import { dateOf, time } from '../packages/core/src/domain';

const catalog = JSON.parse(await readFile(new URL('../docs/data/computing-rooms-2026-10-15.json', import.meta.url), 'utf8')) as { rooms: { code: string }[] };
const codes = new Set(catalog.rooms.map(r => r.code));
assert.equal(codes.size, 28);
const store = await createStore(readConfig());
try {
  await mkdir('tmp/backups', { recursive: true });
  const now = new Date().toISOString();
  const backup = `tmp/backups/pre-computing-hours-${now.replace(/[:.]/g, '-')}.json`;
  const result = await store.transaction(data => {
    const admin = data.state.users.find(u => u.email === 'kittiphon.su@kkumail.com' && u.active && u.role === 'ADMIN');
    assert.ok(admin, 'Active import administrator required');
    const rooms = data.state.rooms.filter(r => codes.has(r.code));
    assert.equal(rooms.length, 28);
    const pending = rooms.filter(r => !r.hours);
    const ids = new Set(pending.map(r => r.id));
    for (const booking of data.state.bookings.filter(b => ids.has(b.roomId) && ['PENDING', 'APPROVED', 'CHECKED_IN'].includes(b.status))) {
      assert.ok(dateOf(booking.start) === dateOf(booking.end) && time(booking.start) >= computingDefaultHours.start && time(booking.end) <= computingDefaultHours.end, `Booking ${booking.id} conflicts with proposed hours`);
    }
    if (!process.argv.includes('--apply')) return { mode: 'preview', rooms: pending.length };
    if (!pending.length) return { mode: 'unchanged', rooms: 0 };
    writeFileSync(backup, JSON.stringify({ createdAt: now, state: data.state }), { flag: 'wx', mode: 0o600 });
    const bookings = JSON.stringify(data.state.bookings);
    pending.forEach(room => { room.hours = structuredClone(computingDefaultHours); });
    assert.equal(JSON.stringify(data.state.bookings), bookings);
    data.state.audit.push({ id: Math.max(0, ...data.state.audit.map(a => a.id)) + 1, actorId: admin.id, at: now, actionType: 'ROOM_HOURS_DEFAULT', text: `ตั้งเวลาเริ่มต้น 08:00–20:00 ทุกวัน ให้ ${pending.length} ห้อง ตามคำขอเจ้าของระบบ โดยรักษารายการจองเดิม` });
    return { mode: 'applied', rooms: pending.length, backup };
  });
  if (process.argv.includes('--apply')) {
    const data = await store.read();
    assert.ok(data.state.rooms.filter(r => codes.has(r.code)).every(r => r.hours));
  }
  console.log(JSON.stringify({ ...result, hours: computingDefaultHours }));
} finally { await store.close(); }
