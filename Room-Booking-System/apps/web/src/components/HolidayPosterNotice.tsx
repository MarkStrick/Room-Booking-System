import { useState } from 'react';
import { useDemo } from '../app/DemoProvider';
import { Modal } from './ui';
import { dateOf, thaiDate } from '../lib/domain';
import { activeHolidayPosters } from '../../../../packages/core/src/holiday-posters';

export function HolidayPosterNotice() {
  const { state, user, mode } = useDemo();
  const today = dateOf(state.now);
  const key = `kku-holiday-hidden:${mode}:${user.id}`;
  const [closed, setClosed] = useState<string[]>([]);
  const [hideToday, setHideToday] = useState(false);
  let hidden = false;
  try { hidden = localStorage.getItem(key) === today; } catch { /* Storage may be disabled. */ }
  const dates = activeHolidayPosters(state);
  const date = hidden ? undefined : dates.find(date => !closed.includes(`${today}:${date}`));
  if (!date) return null;
  function close() {
    if (hideToday) {
      try { localStorage.setItem(key, today); } catch { /* Still dismiss for this visit. */ }
      setClosed(dates.map(date => `${today}:${date}`));
    } else setClosed(previous => [...previous, `${today}:${date}`]);
    setHideToday(false);
  }
  return <Modal title="แจ้งวันหยุดมหาวิทยาลัย" close={close} className="holiday-poster-modal">
    <img className="holiday-poster-image" src={state.settings!.holidayPosters![date]} alt={`โปสเตอร์แจ้งวันหยุด ${thaiDate(`${date}T12:00:00+07:00`)}`} />
    <label className="holiday-poster-dismiss"><input type="checkbox" checked={hideToday} onChange={e => setHideToday(e.target.checked)} />ไม่แสดงอีกในวันนี้</label>
  </Modal>;
}
