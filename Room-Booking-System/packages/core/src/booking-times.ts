import type { AppState, Room } from '../../contracts/src/index';
import { activeStatuses, addDays, availability, dateOf, stamp, time } from './domain';
import { searchSlotError } from './search';

const clockTimes = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Each offered endpoint belongs to a valid, uninterrupted booking interval. */
export function bookingTimeOptions(
  state: AppState, room: Room | undefined, date: string, nextDay: boolean,
  selectedStart = '', extraTimes: string[] = [],
): { starts: string[]; ends: string[] } {
  if (!room || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(stamp(date, '12:00'))) || dateOf(stamp(date, '12:00')) !== date) {
    return { starts: [], ends: [] };
  }
  const endDate = nextDay ? addDays(date, 1) : date;
  const boundaries = state.bookings
    .filter(b => b.roomId === room.id && activeStatuses.includes(b.status))
    .flatMap(b => [b.start, b.end]);
  boundaries.push(...state.closures.filter(c => c.roomId === room.id).flatMap(c => [c.start, c.end]));
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const endpoints = [
    ...clockTimes, ...extraTimes, selectedStart,
    ...(room.hours ? [room.hours.start, room.hours.end] : []),
    ...boundaries.filter(b => [date, endDate].includes(dateOf(b))).map(time),
  ].filter(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t));
  const candidates = [...new Set(endpoints.flatMap(t => [t, ...[-30, 30]
    .map(offset => minutes(t) + offset).filter(value => value >= 0 && value < 1440).map(clock)]))].sort();
  const starts: string[] = [], ends = new Set<string>();
  for (const start of candidates) {
    let hasEnd = false;
    for (const end of candidates) {
      const duration = minutes(end) + (nextDay ? 1440 : 0) - minutes(start);
      if (duration < 30 || duration > 240) continue;
      if (searchSlotError(state, date, start, end, endDate)) continue;
      if (availability(state, room, stamp(date, start), stamp(endDate, end)).kind !== 'available') continue;
      hasEnd = true;
      if (start === selectedStart) ends.add(end);
    }
    if (hasEnd) starts.push(start);
  }
  return { starts, ends: [...ends].sort() };
}
