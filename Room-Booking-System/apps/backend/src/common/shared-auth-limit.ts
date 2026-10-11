import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import type { Store } from '../infrastructure/store';
import type { Config } from './config';

export function authClientAddress(req: Request, c: Config) {
 // Vercel overwrites X-Forwarded-For at its ingress. Never trust it on a direct host.
 const forwarded = c.serverless ? req.get('x-forwarded-for')?.split(',')[0].trim() : undefined;
 return ipKeyGenerator(forwarded && isIP(forwarded) ? forwarded : req.ip ?? req.socket.remoteAddress ?? 'unknown');
}
export async function consumeAuthLimit(store: Store, address: string, secret: string, now = Date.now(), limit = 20) {
 const hash = createHmac('sha256', secret).update(address).digest('hex');
 const key = `auth-rate-${hash}`;
 return store.transaction(data => {
  const at = new Date(now).toISOString();
  data.attempts = data.attempts.filter(a => a.rateCount === undefined || (a.rateUntil ?? '') > at);
  let counter = data.attempts.find(a => a.actorId === 0 && a.key === key);
  if (!counter) {
   counter = { actorId: 0, key, hash, at, rateCount: 0, rateUntil: new Date(now + 60000).toISOString() };
   data.attempts.push(counter);
  }
  const allowed = counter.rateCount! < limit;
  if (allowed) counter.rateCount!++;
  return { allowed, retryAfter: Math.max(1, Math.ceil((Date.parse(counter.rateUntil!) - now) / 1000)) };
 });
}
