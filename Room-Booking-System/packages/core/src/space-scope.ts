import type { AppState } from '../../contracts/src/index';

// Match the owning building, never a room-code prefix from another faculty.
export function isComputingBuilding(name: string): boolean {
  return /วิทยาลัยการคอมพิวเตอร์|คณะวิทยาการคอมพิวเตอร์|วิทยวิภาส|college\s+of\s+computing|^CP(?:\s|[-·(]|$)/iu.test(name.trim());
}

export function computingCatalog(state: AppState) {
  const buildings = state.buildings.filter(b => b.active !== false && isComputingBuilding(b.name));
  const buildingIds = new Set(buildings.map(b => b.id));
  return { buildings, rooms: state.rooms.filter(r => r.active !== false && buildingIds.has(r.buildingId)) };
}
