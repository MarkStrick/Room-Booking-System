import { computingCatalog } from './space-scope';
import type { AppState } from '../../contracts/src/index';
import type { AssistantIntent, AssistantRequest, AssistantResponse, AssistantSearch } from '../../contracts/src/assistant';
import { addDays, availability, dateOf, faqs, stamp, thaiDate, statusLabels } from './domain';
import { bookingSummary } from './lifecycle';
import { searchSlotError } from './search';

export const assistantFaqs = (state: AppState) => state.settings?.faqs.length ? state.settings.faqs : faqs;
export const emptyIntent = (kind: AssistantIntent['kind']): AssistantIntent => ({
  kind, date: null, start: null, end: null, endDate: null, capacity: null,
  amenities: [], building: null, roomQuery: null, faqIndex: null, needsClarification: false,
});
export function ownedBookingAnswer(state: AppState, userId: number, question: string): AssistantResponse | undefined {
  const reference = question.match(/BK-\d{4}-\d+/i)?.[0].toUpperCase();
  if (!reference) return undefined;
  const booking = state.bookings.find(b => b.ref === reference && b.userId === userId);
  return { text: booking ? `${bookingSummary(state,booking)} • ${statusLabels[booking.status]}${booking.reason ? ' • ' + booking.reason : ''}` : 'ไม่พบรายการจองนี้ในบัญชีของคุณ', source: 'guide', mode: 'fallback', checkedAt: state.now, rooms: [], total: 0, needsDetails: false };
}
const digits = (text: string) => text.replace(/[๐-๙]/g, c => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, '').replace(/โปรเจ็คเตอร์|โปรเจคเตอร์|projector/g, 'โปรเจกเตอร์').replace(/wi-fi|wifi/g, 'ไวไฟ');
const validDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(stamp(day,'12:00'))) && dateOf(stamp(day,'12:00')) === day;

// Deliberately bounded fallback: ambiguous dates/times are clarified, never guessed.
export function localAssistantIntent(state: AppState, request: AssistantRequest): AssistantIntent {
  if (request.filters) return { ...emptyIntent('search'), ...request.filters };
  const q = digits(request.question.trim()).toLowerCase();
  const intent = emptyIntent('out-of-scope');
  const searchWords = /ห้อง.*(?:ว่าง|สำหรับ|รองรับ|หา|คน|เวลา|ช่วง)|(?:หา|ค้นหา|ขอ|มี).*ห้อง|ห้องไหน|ห้องใด|available|meeting room/.test(q);
  const followup = !!request.context && /วันนี้|พรุ่งนี้|มะรืน|\d{4}-\d{2}-\d{2}|\d{1,2}[:.]\d{2}|\d+\s*(?:คน|ท่าน)|บ่าย|โมง|ถึง|โปรเจกเตอร์|โปรเจคเตอร์/.test(q);
  const guide = /จอง.*(?:ยังไง|อย่างไร|วิธี)|วิธี.*จอง/.test(q);
  const faqIndex = assistantFaqs(state).findIndex(f => f.q === request.question.trim() || f.keys.some(k => q.includes(k.toLowerCase())));
  if (faqIndex >= 0 && !searchWords && !followup) return { ...intent, kind: 'faq', faqIndex };
  if (guide) return emptyIntent('booking-help');
  if (/กฎการจอง|เงื่อนไขการจอง/.test(q)) return { ...intent, kind: 'faq', faqIndex: assistantFaqs(state).findIndex(f => /จอง.*ล่วงหน้า|กฎ.*จอง|เงื่อนไข.*จอง/.test(f.q)) };
  if (/สถานะ|การจองของฉัน|เช็คสถานะ/.test(q)) return emptyIntent('status-help');
  if (/ติดต่อ|เบอร์โทร|อีเมล.*เจ้าหน้าที่/.test(q)) return emptyIntent('contact');
  if (!searchWords && !followup) {
    if (faqIndex >= 0) return { ...intent, kind: 'faq', faqIndex };
    return intent;
  }
  intent.kind = 'search';
  const prior = request.context;
  intent.date = /มะรืน/.test(q) ? addDays(dateOf(state.now), 2)
    : /พรุ่งนี้/.test(q) ? addDays(dateOf(state.now), 1)
    : /วันนี้/.test(q) ? dateOf(state.now)
    : q.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? prior?.date ?? null;
  const times = [...q.matchAll(/(?:^|[^\d])(\d{1,2})[:.](\d{2})(?!\d)/g)].map(m => `${m[1].padStart(2, '0')}:${m[2]}`);
  const hourRange = q.match(/(?:เวลา|ช่วง)?\s*(\d{1,2})\s*(?:-|–|ถึง)\s*(\d{1,2})(?:\s*(?:โมง|นาฬิกา|น\.|นาที))?(?!\d)/);
  if (times.length >= 2) { intent.start = times[0]; intent.end = times[1]; }
  else if (hourRange) { intent.start = `${hourRange[1].padStart(2,'0')}:00`; intent.end = `${hourRange[2].padStart(2,'0')}:00`; }
  else { intent.start = prior?.start || null; intent.end = prior?.end || null; }
  if (/บ่ายสอง.*(?:ถึง|[-–]).*สี่โมง/.test(q)) { intent.start = '14:00'; intent.end = '16:00'; }
  // A new date resets an old overnight end date. Explicit overnight is supported.
  intent.endDate = /ข้ามคืน|วันถัดไป/.test(q) && intent.date && validDay(intent.date) ? addDays(intent.date, 1) : intent.date;
  const count = q.match(/(\d+)\s*(?:คน|ท่าน)/);
  intent.capacity = count ? Number(count[1]) : prior?.capacity ?? 1;
  intent.amenities = /ไม่ต้อง.*(?:โปรเจกเตอร์|โปรเจคเตอร์|อุปกรณ์)/.test(q) ? []
    : [...new Set(state.rooms.flatMap(r => [...r.amenities, ...(r.inventory ?? []).filter(i => i.total > i.damaged).map(i => i.name)]))]
      .filter(a => normalize(q).includes(normalize(a)));
  if (!intent.amenities.length && !/ไม่ต้อง/.test(q)) intent.amenities = prior?.amenities ?? [];
  if (/โปรเจกเตอร์|โปรเจคเตอร์|โปรเจ็คเตอร์|projector/.test(q) && !/ไม่ต้อง/.test(q)) intent.amenities = [...new Set([...intent.amenities, 'โปรเจกเตอร์'])];
  intent.building = state.buildings.find(b => q.includes(b.name.toLowerCase()))?.name ?? prior?.building ?? null;
  intent.roomQuery = state.rooms.find(r => q.includes(r.name.toLowerCase()) || q.includes(r.code.toLowerCase()))?.name ?? prior?.roomQuery ?? null;
  intent.needsClarification = times.length === 1 || /ช่วงเช้า|ช่วงบ่าย|เย็น|ค่ำ/.test(q) && times.length < 2 && !hourRange;
  return intent;
}

export function answerAssistant(state: AppState, intent: AssistantIntent, mode: AssistantResponse['mode']): AssistantResponse {
  const reply: AssistantResponse = { text: '', mode, source: 'guide', checkedAt: state.now, rooms: [], total: 0, needsDetails: false };
  const references = assistantFaqs(state);
  if (intent.kind === 'booking-help') return { ...reply, text: 'ค้นหาห้องโดยเลือกวันที่ เวลา และจำนวนคน จากนั้นเลือกห้อง กรอกวัตถุประสงค์และส่งคำขอ รอเจ้าหน้าที่อนุมัติ แล้วเช็คอินจาก “การจองของฉัน” เมื่อถึงเวลาใช้งานครับ' };
  if (intent.kind === 'status-help') return { ...reply, text: 'ตรวจสถานะล่าสุดได้ที่ “การจองของฉัน” ครับ รออนุมัติ = เจ้าหน้าที่ยังไม่ตัดสิน, อนุมัติแล้ว = รอเข้าใช้, กำลังใช้งาน = เช็คอินแล้ว และไม่อนุมัติ = ดูเหตุผลในรายละเอียดรายการ' };
  if (intent.kind === 'contact') return { ...reply, text: state.settings?.contactEmail || state.settings?.contactPhone
    ? `ติดต่อเจ้าหน้าที่ได้ที่ ${[state.settings.contactEmail, state.settings.contactPhone].filter(Boolean).join(' • ')}`
    : 'ยังไม่ได้ตั้งช่องทางติดต่อ กรุณาสอบถามเจ้าหน้าที่ผู้ดูแลห้องครับ' };
  if (intent.kind === 'faq' && intent.faqIndex !== null && references[intent.faqIndex]) return {
    ...reply, source: 'faq', text: references[intent.faqIndex].a, faqQuestions: [references[intent.faqIndex].q],
  };
  if (intent.kind !== 'search') return { ...reply, text: 'ผมช่วยค้นหาห้องว่างและตอบเรื่องการใช้ระบบจองห้อง มข. ได้ครับ หากไม่พบข้อมูลในคู่มือ กรุณาติดต่อเจ้าหน้าที่ ลองถาม “พรุ่งนี้ 10:00–12:00 มีห้องสำหรับ 10 คนไหม”', faqQuestions: references.slice(0, 3).map(f => f.q) };
  const search: AssistantSearch = {
    date: intent.date ?? '', start: intent.start ?? '', end: intent.end ?? '', endDate: intent.endDate ?? intent.date ?? '',
    capacity: intent.capacity ?? 1, amenities: intent.amenities, building: intent.building ?? '', roomQuery: intent.roomQuery ?? '',
  };
  reply.search = search;
  reply.source = 'catalog';
  if (search.date && !validDay(search.date) || search.endDate && !validDay(search.endDate)) return { ...reply, search: { ...search, date: '', endDate: '' }, needsDetails: true, text: 'วันที่ไม่ถูกต้องครับ กรุณาเลือกวันที่ใหม่ด้านล่าง' };
  if (!search.date || !search.start || !search.end || intent.needsClarification) {
    return { ...reply, needsDetails: true, text: !search.date ? 'ต้องการใช้ห้องวันไหน และช่วงกี่โมงถึงกี่โมงครับ? ระบุจำนวนคนหรืออุปกรณ์ที่ต้องการเพิ่มได้'
      : `ต้องการใช้ห้องวันที่ ${thaiDate(stamp(search.date, '12:00'))} ช่วงกี่โมงถึงกี่โมงครับ? เช่น 14:00–16:00 สำหรับ 10 คน หรือเลือกเวลาด้านล่าง` };
  }
  if (!Number.isInteger(search.capacity) || search.capacity < 1 || search.capacity > 10000) return { ...reply, needsDetails: true, text: 'กรุณาระบุจำนวนคนตั้งแต่ 1 ถึง 10,000 คนครับ' };
  const slotError = searchSlotError(state, search.date, search.start, search.end, search.endDate);
  if (slotError) return { ...reply, needsDetails: true, text: `${slotError}ครับ เลือกวันที่และเวลาใหม่ด้านล่างได้เลย` };
  const matched = computingCatalog(state).rooms.filter(r => {
    const b = state.buildings.find(b => b.id === r.buildingId);
    return r.active !== false && b && b.active !== false && r.capacity >= search.capacity
      && (!search.building || normalize(b.name).includes(normalize(search.building)))
      && (!search.roomQuery || normalize(`${r.name} ${r.code}`).includes(normalize(search.roomQuery)))
      && search.amenities.every(a => r.amenities.some(v => normalize(v).includes(normalize(a)))
        || (r.inventory ?? []).some(i => i.total > i.damaged && normalize(i.name).includes(normalize(a))))
      && availability(state, r, stamp(search.date, search.start), stamp(search.endDate, search.end)).kind === 'available';
  }).sort((a,b) => a.capacity - b.capacity || a.id - b.id);
  reply.total = matched.length;
  reply.rooms = matched.slice(0, 6).map(r => ({ id: r.id, name: r.name, building: state.buildings.find(b => b.id === r.buildingId)!.name, capacity: r.capacity, amenities: r.amenities }));
  const slot = `${thaiDate(stamp(search.date,'12:00'),true)} ${search.start}–${search.end}${search.endDate !== search.date ? ' (สิ้นสุดวันถัดไป)' : ''} น.`;
  reply.text = matched.length ? `พบ ${matched.length} ห้องที่ว่างสำหรับ ${search.capacity} คนขึ้นไป ในช่วง ${slot}${matched.length > 6 ? ' แสดง 6 ห้องแรก' : ''}ครับ เลือกห้องเพื่อกรอกคำขอจองได้เลย`
    : `ไม่พบห้องที่จองได้ตามเงื่อนไขในช่วง ${slot}ครับ ลองเปลี่ยนเวลา ลดจำนวนคน หรือปรับอุปกรณ์ที่ต้องการ`;
  return reply;
}
