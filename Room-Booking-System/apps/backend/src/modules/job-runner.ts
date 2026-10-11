import nodemailer from 'nodemailer';
import type { Config } from '../common/config';
import type { Store } from '../infrastructure/store';
import { claimMail, finishMail, runTimers } from './jobs';

export async function runJobCycle(store: Store, c: Config, budgetMs = 45000) {
 const deadline = Date.now() + budgetMs;
 await store.transaction(d => {
  const now = new Date().toISOString();
  runTimers(d, now);
  d.state.settings = { contactEmail: '', contactPhone: '', faqs: [], ...d.state.settings, workerAt: now };
 });
 let sent = 0, failed = 0;
 if (!c.smtpHost || !c.mailFrom) return { sent, failed, emailConfigured: false };
 const transport = nodemailer.createTransport({
  host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure, requireTLS: !c.smtpSecure,
  auth: c.smtpUser ? { user: c.smtpUser, pass: c.smtpPassword } : undefined,
  connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
 });
 try {
  for (let i = 0; i < 20 && Date.now() < deadline - 15000; i++) {
   const mail = await store.transaction(d => claimMail(d, new Date().toISOString()));
   if (!mail) break;
   let success = false;
   try {
    const result = await transport.sendMail({ from: c.mailFrom, to: mail.to, subject: mail.notice.subject, text: mail.notice.content, messageId: `<kku-notice-${mail.notice.id}@${new URL(c.origin).hostname}>` });
    success = result.accepted.includes(mail.to);
   } catch { console.error(JSON.stringify({ event: 'mail_attempt_failed', noticeId: mail.notice.id })); }
   await store.transaction(d => finishMail(d, mail.notice.id, mail.token, new Date().toISOString(), success));
   if (success) sent++; else failed++;
  }
 } finally { transport.close(); }
 return { sent, failed, emailConfigured: true };
}
