import type { AppState } from '../../contracts/src/index';
import { addDays, dateOf } from './domain';

export function activeHolidayPosters(state: AppState) {
  const today = dateOf(state.now);
  return [...state.holidays].sort().filter(date => today >= addDays(date, -7) && today <= date && !!state.settings?.holidayPosters?.[date]);
}
