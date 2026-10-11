import { z } from 'zod';
import type { Config } from '../common/config';
import type { Store } from '../infrastructure/store';
import { hashPassword } from './password-hash';
import { newPassword } from './password-auth';

// Operator-only utility. There is deliberately no HTTP route for first-admin creation.
export async function bootstrapFirstAdmin(store: Store, c: Config, address: string, password: string) {
 const email = z.email().max(254).parse(address.trim().toLowerCase());
 newPassword.parse(password);
 if (!c.bootstrapAdmins.includes(email)) throw new Error('Email must be listed in BOOTSTRAP_ADMIN_EMAILS');
 const passwordHash = await hashPassword(password);
 return store.transaction(data => {
  if (data.state.users.some(u => u.role === 'ADMIN' && u.active)) throw new Error('An active administrator already exists; use normal account administration');
  if (data.state.users.some(u => u.email.toLowerCase() === email)) throw new Error('This email already belongs to an account; do not overwrite it with bootstrap');
  const id = Math.max(0, ...data.state.users.map(u => u.id)) + 1;
  const now = new Date().toISOString();
  data.state.users.push({ id, email, name: 'ผู้ดูแลระบบ', role: 'ADMIN', active: true, phone: '', affiliation: '' });
  data.credentials.push({ userId: id, passwordHash, updatedAt: now, failedAttempts: 0 });
  data.state.audit.unshift({ id: Math.max(0, ...data.state.audit.map(a => a.id)) + 1, at: now, actorId: id, text: 'สร้างผู้ดูแลคนแรกโดยผู้ดำเนินการฝั่งเซิร์ฟเวอร์' });
  return { id };
 });
}
