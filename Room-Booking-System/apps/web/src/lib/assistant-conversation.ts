import type { ChatMessage } from '../reference/types';
import type { AssistantSearch } from '../../../../packages/contracts/src/assistant';

export const ASSISTANT_IDLE_MS = 10 * 60 * 1000;
export interface AssistantConversation {
  version: 1;
  owner: string;
  id: string;
  lastActivityAt: number;
  messages: ChatMessage[];
  context?: AssistantSearch;
}
export type ChatStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (owner: string) => `kku-chat:v1:${owner}`;
export const freshConversation = (owner: string, now = Date.now()): AssistantConversation => ({ version: 1, owner, id: crypto.randomUUID(), lastActivityAt: now, messages: [] });
export const conversationExpired = (chat: AssistantConversation, now = Date.now()) => now - chat.lastActivityAt >= ASSISTANT_IDLE_MS;
const text = (value: unknown, max = 10000): value is string => typeof value === 'string' && value.length <= max;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 100 && value.every(v => text(v,1000));
const day = (value: unknown) => text(value,10) && (value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00+07:00`)));
const clock = (value: unknown) => text(value,5) && (value === '' || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));
function search(value: unknown): value is AssistantSearch {
  if (!value || typeof value !== 'object') return false;
  const s = value as AssistantSearch;
  return day(s.date) && day(s.endDate) && clock(s.start) && clock(s.end) && Number.isInteger(s.capacity) && s.capacity >= 1 && s.capacity <= 10000 && strings(s.amenities) && text(s.building,100) && text(s.roomQuery,100);
}
function message(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as ChatMessage;
  if (!text(m.id,100) || !text(m.text) || !['user','bot'].includes(m.sender) || !text(m.timestamp,50) || !Number.isFinite(Date.parse(m.timestamp))) return false;
  const r = m.response;
  if (!r) return true;
  return text(r.text) && ['gemini','fallback','demo'].includes(r.mode) && ['catalog','faq','guide'].includes(r.source)
    && text(r.checkedAt,50) && Number.isFinite(Date.parse(r.checkedAt)) && typeof r.needsDetails === 'boolean' && Number.isInteger(r.total)
    && Array.isArray(r.rooms) && r.rooms.length <= 6 && r.rooms.every(room => Number.isInteger(room.id) && text(room.name,1000) && text(room.building,1000) && Number.isInteger(room.capacity) && strings(room.amenities))
    && (r.search === undefined || search(r.search)) && (r.faqQuestions === undefined || strings(r.faqQuestions));
}
export function loadConversation(storage: ChatStorage | undefined, owner: string, now = Date.now()): AssistantConversation {
  try {
    const raw = storage?.getItem(key(owner));
    if (raw) {
      const c = JSON.parse(raw) as AssistantConversation;
      if (c.version === 1 && c.owner === owner && text(c.id,100) && Number.isFinite(c.lastActivityAt) && c.lastActivityAt <= now
        && !conversationExpired(c,now) && Array.isArray(c.messages) && c.messages.length <= 60 && c.messages.every(message)
        && (c.context === undefined || search(c.context))) return c;
      storage?.removeItem(key(owner));
    }
  } catch { /* Disabled or malformed storage must not break the chat. */ }
  return freshConversation(owner,now);
}
export function saveConversation(storage: ChatStorage | undefined, chat: AssistantConversation) {
  try { storage?.setItem(key(chat.owner),JSON.stringify(chat)); } catch { /* Continue in memory when storage is unavailable. */ }
}
export function clearConversation(storage: ChatStorage | undefined, owner: string) {
  try { storage?.removeItem(key(owner)); } catch { /* Storage is optional. */ }
}
