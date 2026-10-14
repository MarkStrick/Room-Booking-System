import { playSound, type SoundEffect } from '../lib/sound-effects';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Command } from '../../../../packages/contracts/src/index';
import { DemoContext } from './DemoProvider';
import { createSeed } from '../lib/seed';
import { executeCommand, RecordedRejection } from '../lib/domain';
import { request } from '../lib/api';

// This component is loaded only after the server confirms a live ADMIN session.
// Simulated identities never become server sessions; all changes stay in memory.
export default function AdminSandbox({ children, onExit }: { children: ReactNode; onExit: () => void }) {
  const [state, setState] = useState(createSeed);
  const stateRef = useRef(state);
  const [userId, setUserId] = useState(3);
  const [toast, setToast] = useState('');
  function showToast(message: string, sound: SoundEffect = 'notification') {
    if (message) playSound(sound);
    setToast(message);
  }
  const user = state.users.find(u => u.id === userId) ?? state.users.find(u => u.role === 'ADMIN')!;
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => showToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function authorize() {
    try { await request('/admin/test-tools'); }
    catch (error) { onExit(); throw error; }
  }
  async function run(command: Command, message = 'บันทึกข้อมูลจำลองแล้ว') {
    await authorize();
    try {
      const next = executeCommand(stateRef.current, user.id, command);
      stateRef.current = next; setState(next);
      if (message) { playSound('success'); showToast(message); }
    } catch (error) {
      if (error instanceof RecordedRejection) { stateRef.current = error.state; setState(error.state); }
      throw error;
    }
  }
  const unavailable = async () => { throw new Error('จัดการบัญชีจริงได้หลังออกจากพื้นที่ทดสอบ'); };
  return <DemoContext.Provider value={{
    state, user, run, toast, showToast, mode: 'demo', persistent: true,
    canTest: true, openSandbox: async () => {}, switchUser: setUserId,
    reset: () => { const next = createSeed(); stateRef.current = next; setState(next); setUserId(3); showToast('เริ่มข้อมูลจำลองใหม่แล้ว'); },
    logout: async () => onExit(), manageAccess: unavailable, refresh: async (manual) => { if (manual) showToast('อัปเดตข้อมูลจำลองแล้ว', 'success'); },
  }}><div className="sandbox-frame">
    <div className="connection-banner sandbox-banner" role="status">
      <span>พื้นที่ทดสอบสำหรับผู้ดูแล • ใช้ข้อมูลจำลอง • ไม่บันทึกลงระบบจริง</span>
      <button type="button" onClick={onExit}>ออกจากพื้นที่ทดสอบ</button>
    </div>
    {children}
  </div></DemoContext.Provider>;
}
