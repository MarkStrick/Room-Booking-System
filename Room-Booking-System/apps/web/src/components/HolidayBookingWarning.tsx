import { CalendarX2, ArrowRight } from 'lucide-react';
import { thaiDate } from '../lib/domain';

export function HolidayBookingWarning({ date, onChooseDate }: { date: string; onChooseDate: () => void }) {
  return <div id="holiday-booking-warning" className="holiday-booking-warning" role="alert">
    <CalendarX2 size={24} aria-hidden="true" />
    <div>
      <strong>วันหยุดมหาวิทยาลัย — ไม่เปิดรับการจอง</strong>
      <p>{thaiDate(`${date}T12:00:00+07:00`)} ทุกห้องปิดให้บริการ กรุณาเลือกวันที่อื่น</p>
      <button type="button" onClick={onChooseDate}>เปลี่ยนวันที่จอง<ArrowRight size={16} aria-hidden="true" /></button>
    </div>
  </div>;
}
