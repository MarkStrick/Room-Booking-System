import { useState } from 'react';
import { isHolidayPoster } from '../../../../packages/core/src/media';

export function HolidayPosterUpload({ value, onChange, onBusyChange }: { value: string; onChange: (value: string) => void; onBusyChange: (busy: boolean) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('เลือกไฟล์ JPG, PNG หรือ WebP ขนาดไม่เกิน 10 MB');
      return;
    }
    setBusy(true);
    onBusyChange(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error();
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let result = '';
      for (const quality of [0.9, 0.75, 0.6, 0.45]) {
        result = canvas.toDataURL('image/jpeg', quality);
        if (isHolidayPoster(result)) break;
      }
      if (!isHolidayPoster(result)) throw new Error();
      onChange(result);
    } catch {
      setError('อ่านรูปไม่ได้หรือรูปมีรายละเอียดมากเกินไป กรุณาลองรูปอื่น');
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
      onBusyChange(false);
    }
  }
  return <div className="holiday-upload">
    <label>โปสเตอร์แจ้งวันหยุด (ไม่บังคับ)
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
    <p className="subtle">JPG, PNG หรือ WebP ไม่เกิน 10 MB · ระบบปรับขนาดรูปให้อัตโนมัติ<br />แสดงก่อนวันหยุด 7 วันจนถึงวันหยุด บนหน้าค้นหาและจองห้อง</p>
    {busy && <p role="status">กำลังเตรียมรูป…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {value && <><img className="holiday-upload-preview" src={value} alt="ตัวอย่างโปสเตอร์วันหยุด" /><button type="button" className="btn ghost" disabled={busy} onClick={() => onChange('')}>ลบรูปโปสเตอร์</button></>}
  </div>;
}
