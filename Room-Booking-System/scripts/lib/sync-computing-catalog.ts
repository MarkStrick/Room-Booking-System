import { randomUUID } from 'node:crypto';
import type { Command } from '../../packages/contracts/src/index';
import type { Data } from '../../apps/backend/src/infrastructure/store';
import { applyCommand } from '../../apps/backend/src/modules/booking-service';

export interface ComputingCatalog {
  checkedAt: string;
  buildings: { externalId: number; name: string; floors: number }[];
  rooms: { code: string; name: string; externalBuildingId: number; floor: number; capacity: number; type: string; amenities: string[]; imageUrl?: string }[];
}

// Only retire the sample/other-faculty catalogs installed by the older importers.
const legacyRoom = (code: string) => /^(DEMO-[SM]\d{2}|KKU-ED-(1507|TEAL)|KKU-ODT-M[13])$/.test(code);
const activeStatuses = new Set(['PENDING', 'APPROVED', 'CHECKED_IN']);
// Owner-approved default based on the source calendar's display range, not verified university policy.
export const computingDefaultHours = { start: '08:00', end: '20:00', weekdays: [0, 1, 2, 3, 4, 5, 6], leadMinutes: 0 };

export function syncComputingCatalog(data: Data, catalog: ComputingCatalog, actorId: number, now: string) {
  if (!data.state.users.some(u => u.id === actorId && u.role === 'ADMIN' && u.active)) throw new Error('An active administrator is required');
  if (catalog.buildings.length !== 2 || new Set(catalog.buildings.map(b => b.externalId)).size !== 2 ||
      !catalog.buildings.every(b => [1, 2].includes(b.externalId)) || !catalog.rooms.length ||
      new Set(catalog.rooms.map(r => r.code)).size !== catalog.rooms.length ||
      !catalog.buildings.every(b => catalog.rooms.some(r => r.externalBuildingId === b.externalId))) throw new Error('Expected a complete two-building catalog with unique room codes');
  for (const room of catalog.rooms) {
    const building = catalog.buildings.find(b => b.externalId === room.externalBuildingId);
    if (!building || !Number.isInteger(room.floor) || room.floor < 1 || room.floor > building.floors ||
        !Number.isInteger(room.capacity) || room.capacity < 1 || !room.code.trim() || !room.name.trim() ||
        !room.type.trim() || !Array.isArray(room.amenities)) throw new Error(`Invalid catalog room: ${room.code}`);
  }
  const result = { added: [] as string[], updated: [] as string[], archived: [] as string[], retainedForBookings: [] as string[], archivedBuildings: [] as string[] };
  const execute = (command: Command) => {
    const response = applyCommand(data, actorId, command, randomUUID(), now);
    if (response instanceof Error) throw response;
  };
  const buildings = new Map<number, number>();
  for (const entry of catalog.buildings) {
    // Adopt an existing SC building by its code instead of creating a duplicate.
    const marker = entry.externalId === 1 ? /วิทยวิภาส|SC[.\s-]*0?9\b/iu : /SC[.\s-]*0?6\b/iu;
    const matches = data.state.buildings.filter(b => b.name === entry.name || marker.test(b.name));
    if (matches.length > 1) throw new Error(`Ambiguous existing building: ${entry.name}`);
    const existing = matches[0];
    const floors = Math.max(entry.floors, existing?.floors ?? 0);
    if (!existing || existing.name !== entry.name || existing.floors !== floors) execute({ type: 'BUILDING_SAVE', id: existing?.id, name: entry.name, floors });
    const building = data.state.buildings.find(b => b.name === entry.name)!;
    if (building.active === false) execute({ type: 'BUILDING_ACTIVE', buildingId: building.id, active: true });
    buildings.set(entry.externalId, building.id);
    for (let number = 1; number <= floors; number++) {
      if (building.levels?.find(f => f.number === number)?.name !== `ชั้น ${number}`) execute({ type: 'FLOOR_SAVE', buildingId: building.id, number, name: `ชั้น ${number}` });
    }
  }
  for (const entry of catalog.rooms) {
    const buildingId = buildings.get(entry.externalBuildingId)!;
    const matches = data.state.rooms.filter(r => r.code === entry.code || (r.buildingId === buildingId && r.name === entry.name));
    if (matches.length > 1) throw new Error(`Ambiguous existing room: ${entry.code}`);
    const existing = matches[0];
    const room = {
      ...(existing ?? { status: 'AVAILABLE' as const, reason: '', scene: 0 }),
      code: entry.code, name: entry.name, buildingId, floor: entry.floor,
      capacity: entry.capacity, type: entry.type, amenities: entry.amenities, active: true,
      hours: existing?.hours ?? structuredClone(computingDefaultHours),
      ...(entry.imageUrl && !existing?.imageUrl ? { imageUrl: entry.imageUrl } : {}),
    };
    const changed = !existing || Object.entries(room).some(([key, value]) => JSON.stringify(existing[key as keyof typeof existing]) !== JSON.stringify(value));
    if (changed) {
      execute({ type: 'ROOM_SAVE', room });
      result[existing ? 'updated' : 'added'].push(entry.code);
    }
  }
  const legacyBuildings = new Set(data.state.rooms.filter(r => legacyRoom(r.code)).map(r => r.buildingId));
  for (const room of [...data.state.rooms]) {
    if (!legacyRoom(room.code) || room.active === false) continue;
    if (data.state.bookings.some(b => b.roomId === room.id && activeStatuses.has(b.status))) {
      result.retainedForBookings.push(room.code);
      continue;
    }
    execute({ type: 'ROOM_ACTIVE', roomId: room.id, active: false });
    result.archived.push(room.code);
  }
  for (const id of legacyBuildings) {
    const building = data.state.buildings.find(b => b.id === id)!;
    if (building.active !== false && ![...buildings.values()].includes(id) && !data.state.rooms.some(r => r.buildingId === id && r.active !== false)) {
      execute({ type: 'BUILDING_ACTIVE', buildingId: id, active: false });
      result.archivedBuildings.push(building.name);
    }
  }
  return result;
}
