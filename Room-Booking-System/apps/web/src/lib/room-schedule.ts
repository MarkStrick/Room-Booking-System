import type { AppState } from '../../../../packages/contracts/src/index';
import { activeStatuses, addDays, dateOf, time, statusLabels, stamp, overlaps, availability } from './domain';
import { searchSlotError } from '../../../../packages/core/src/search';
import { bookingTimeOptions } from '../../../../packages/core/src/booking-times';

export const scheduleColors = { PENDING: '#fff0c2', APPROVED: '#d7edfc', CHECKED_IN: '#cdf2e4', CLOSED: '#e4e9f0' };
export type ScheduleView = 'day' | 'week' | 'month';

export function scheduleDates(date: string, view: ScheduleView): string[] {
  if (view === 'day') return [date];
  const first = view === 'month' ? `${date.slice(0, 7)}-01` : date;
  const weekday = new Date(stamp(first, '12:00')).getUTCDay();
  const monday = addDays(first, -((weekday + 6) % 7));
  return Array.from({ length: view === 'month' ? 42 : 7 }, (_, i) => addDays(monday, i));
}

export function scheduleNavigate(date: string, view: ScheduleView, direction: number): string {
  if (view !== 'month') return addDays(date, direction * (view === 'week' ? 7 : 1));
  const target = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  target.setUTCMonth(target.getUTCMonth() + direction);
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(Number(date.slice(8)), last));
  return target.toISOString().slice(0, 10);
}

// A display range is not an opening-hours policy; booking still requires verified room.hours.
export function scheduleDisplayHours(state: AppState, roomIds: number[], dates: string[]) {
  const ranges = dates.map(date => scheduleHours(state, roomIds, date)).filter(h => h !== null);
  const missing = state.rooms.some(r => roomIds.includes(r.id) && !r.hours);
  const startHour = Math.min(...ranges.map(h => h.startHour), ...(missing || !ranges.length ? [8] : []));
  const endHour = Math.max(...ranges.map(h => h.endHour), ...(missing || !ranges.length ? [20] : []));
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const cellDuration = ranges.reduce((step, h) => gcd(step, h.cellDuration), 30);
  return { startHour, endHour, cellDuration };
}
const localTime = (value: string) => `${dateOf(value)}T${time(value)}:00`;

export function scheduleHours(state: AppState, roomIds: number[], date: string) {
  if (!date || state.holidays.includes(date)) return null;
  const weekday = new Date(stamp(date, '12:00')).getUTCDay();
  const previousWeekday = (weekday + 6) % 7;
  const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  const intervals: number[][] = [];
  for (const room of state.rooms.filter(r => roomIds.includes(r.id))) {
    const hours = room.hours;
    if (!hours) continue;
    const start = minutes(hours.start), end = minutes(hours.end);
    if (start < end && hours.weekdays.includes(weekday)) intervals.push([start, end]);
    if (start > end) {
      if (hours.weekdays.includes(weekday)) intervals.push([start, 1440]);
      if (!state.holidays.includes(addDays(date, -1)) && hours.weekdays.includes(previousWeekday) && end > 0) intervals.push([0, end]);
    }
  }
  if (!intervals.length) return null;
  const start = Math.min(...intervals.map(([start]) => start));
  const end = Math.max(...intervals.map(([, end]) => end));
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  return { startHour: start / 60, endHour: end / 60, cellDuration: gcd(30, gcd(start, end)), start: clock(start), end: clock(end) };
}

export function roomScheduleEvents(state: AppState, roomIds: number[], date: string) {
  const from = stamp(date, '00:00');
  const to = new Date(Date.parse(from) + 86400000).toISOString();
  return [
    ...state.bookings.filter(b => roomIds.includes(b.roomId) && activeStatuses.includes(b.status) && overlaps(b.start, b.end, from, to))
      .map(b => ({ id: `booking-${b.id}`, resource: String(b.roomId), start: localTime(b.start), end: localTime(b.end),
        text: statusLabels[b.status], backColor: scheduleColors[b.status as keyof typeof scheduleColors],
        fontColor: '#183c57', borderColor: '#ffffff', barHidden: true })),
    ...state.closures.filter(c => roomIds.includes(c.roomId) && overlaps(c.start, c.end, from, to))
      .map(c => ({ id: `closure-${c.id}`, resource: String(c.roomId), start: localTime(c.start), end: localTime(c.end),
        text: 'ปิดชั่วคราว', backColor: scheduleColors.CLOSED, fontColor: '#39475a', borderColor: '#ffffff', barHidden: true })),
  ];
}

export function scheduleSlotIssue(state: AppState, roomId: number, date: string, start: string, end: string) {
  const room = state.rooms.find(r => r.id === roomId);
  if (!room?.hours) return 'ยังไม่ได้ตั้งเวลาให้บริการ กรุณาติดต่อผู้ดูแล';
  const issue = searchSlotError(state, date, start, end);
  if (issue) return issue;
  const result = availability(state, room, stamp(date, start), stamp(date, end));
  return result.kind === 'available' ? '' : result.reason || result.label;
}

export function scheduleFreeSlots(state: AppState, roomId: number, date: string) {
  const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const room = state.rooms.find(r => r.id === roomId);
  if (!room?.hours) return [];
  return bookingTimeOptions(state, room, date, false).starts
    .map(start => ({ start, end: clock(Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + 30) }))
    .filter(slot => !scheduleSlotIssue(state, roomId, date, slot.start, slot.end));
}
