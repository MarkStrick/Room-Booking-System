import type { AppState } from '../../contracts/src/index';
import { dateOf, ms, stamp } from './domain';

export function searchSlotError(state: AppState, date: string, start: string, end: string, endDate=date): string {
  if (!date || !start || !end) return 'เลือกวันที่ เวลาเริ่ม และเวลาสิ้นสุดเพื่อเช็คห้องว่าง';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return 'วันที่หรือเวลาไม่ถูกต้อง';
  const from = ms(stamp(date,start)), to = ms(stamp(endDate,end));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !Number.isFinite(from) || !Number.isFinite(to) || dateOf(stamp(date,start)) !== date || dateOf(stamp(endDate,end)) !== endDate) return 'วันที่หรือเวลาไม่ถูกต้อง';
  if (from <= ms(state.now)) return 'กรุณาเลือกเวลาในอนาคต';
  if (date > dateOf(new Date(ms(state.now)+15*86400000).toISOString())) return 'จองล่วงหน้าได้ไม่เกิน 15 วัน';
  if (to <= from) return 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม';
  if (to-from < 30*60000 || to-from > 4*3600000) return 'ระยะเวลาจองต้องอยู่ระหว่าง 30 นาทีถึง 4 ชั่วโมง';
  if (state.holidays.includes(date)||state.holidays.includes(dateOf(new Date(to-1).toISOString()))) return 'วันที่เลือกเป็นวันหยุด ไม่เปิดให้จอง';
  return '';
}
