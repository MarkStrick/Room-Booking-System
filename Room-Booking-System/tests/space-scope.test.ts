import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../apps/web/src/lib/seed';
import { computingCatalog, isComputingBuilding } from '../packages/core/src/space-scope';
import { answerAssistant, emptyIntent } from '../packages/core/src/assistant';

test('CP catalog accepts faculty and building names used by the college', () => {
  for (const name of ['วิทยาลัยการคอมพิวเตอร์', 'อาคารวิทยวิภาส', 'College of Computing', 'CP (ข้อมูลจำลอง)']) assert.ok(isComputingBuilding(name));
  for (const name of ['คณะวิศวกรรมศาสตร์', 'สำนักหอสมุด', 'CPR Center']) assert.equal(isComputingBuilding(name), false);
});

test('discovery excludes other faculties and archived locations without deleting booking history', () => {
  const state = createSeed();
  state.buildings.push({ id: 9, name: 'คณะศึกษาศาสตร์', floors: 5 });
  state.rooms.push({ ...state.rooms[0], id: 99, code: 'CP-OTHER', buildingId: 9 });
  const before = structuredClone(state);
  const catalog = computingCatalog(state);
  assert.equal(catalog.rooms.length, 6);
  assert.equal(catalog.rooms.some(r => r.id === 99), false);
  assert.deepEqual(state, before);
  state.buildings[0].active = false;
  assert.equal(computingCatalog(state).rooms.length, 0);
});

test('assistant recommendations use the same CP scope as room discovery', () => {
  const state = createSeed();
  state.now = '2026-10-08T01:00:00Z';
  state.buildings.push({ id: 9, name: 'สำนักหอสมุด', floors: 5 });
  const room = { ...state.rooms[0], id: 99, buildingId: 9, hours: { start: '08:00', end: '18:00', weekdays: [0,1,2,3,4,5,6], leadMinutes: 0 } };
  state.rooms = [room];
  const result = answerAssistant(state, { ...emptyIntent('search'), date: '2026-10-09', start: '10:00', end: '11:00', endDate: '2026-10-09', capacity: 1 }, 'demo');
  assert.equal(result.total, 0);
  assert.deepEqual(result.rooms, []);
});
