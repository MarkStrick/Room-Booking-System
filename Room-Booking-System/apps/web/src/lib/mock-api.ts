import type {
  AppState,
  Command,
} from "../../../../packages/contracts/src/index";
import { createSeed } from "./seed";
import { executeCommand } from "./domain";

const KEY = "kku-space-prototype:v1";
const collections = [
  "users",
  "buildings",
  "rooms",
  "equipment",
  "bookings",
  "notices",
  "violations",
  "penalties",
  "closures",
  "inspections",
  "messages",
  "audit",
  "holidays",
  "assignments",
];
export const mockApi = {
  load(): AppState {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (raw && typeof raw === "object") {
        const r = raw as Record<string, unknown>;
        if (
          r.schema === 1 &&
          typeof r.now === "string" &&
          Number.isFinite(Date.parse(r.now)) &&
          collections.every((k) => Array.isArray(r[k])) &&
          (r.users as unknown[]).length &&
          (r.rooms as unknown[]).length
        )
          return r as unknown as AppState;
      }
    } catch {
      /* Unavailable storage starts a fresh, usable demo. */
    }
    return createSeed();
  },
  save(state: AppState): boolean {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  },
  async command(
    readCurrent: () => AppState,
    actorId: number,
    command: Command,
  ): Promise<AppState> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return executeCommand(readCurrent(), actorId, command);
  },
};
