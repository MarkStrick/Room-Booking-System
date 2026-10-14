import { resolve } from 'node:path';
import { isIP } from 'node:net';
import { z } from 'zod';
export interface Config {
 production:boolean;host:string;port:number;origin:string;store:'postgres'|'sqlite';dbFile:string;databaseUrl:string;databaseCa?:string;databaseCaPem?:string;trustProxy:string[];
 serverless:boolean;cronSecret:string;rateLimitSecret:string;
 devLogin:boolean;googleId:string;googleSecret:string;allowedDomains:string[];allowPublicGoogle:boolean;bootstrapAdmins:string[];
 smtpHost:string;smtpPort:number;smtpSecure:boolean;smtpUser:string;smtpPassword:string;mailFrom:string;
 geminiApiKey:string;geminiModel:string;assistantDailyLimit:number;
}
export const mailConfigured=(c:Config)=>!!(c.smtpHost&&c.mailFrom&&(!c.smtpUser||c.smtpPassword));
const list=(s:string|undefined)=>(s??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
export function readConfig(env:NodeJS.ProcessEnv=process.env):Config {
 const serverless=env.VERCEL==='1';
 const production=env.NODE_ENV==='production'||serverless;
 const origin = new URL(env.APP_ORIGIN??'http://127.0.0.1:5174');
 if (origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password) throw new Error('APP_ORIGIN must be an origin without path or credentials');
 const store=env.DB_DRIVER??(production?'postgres':'sqlite');
 if (store!=='postgres'&&store!=='sqlite') throw new Error('Unsupported DB_DRIVER');
 const config:Config={production,serverless,cronSecret:env.CRON_SECRET??'',rateLimitSecret:env.RATE_LIMIT_SECRET??'',origin:origin.origin,host:env.HOST??'127.0.0.1',port:z.coerce.number().int().min(1).max(65535).parse(env.PORT??3001),store,
 trustProxy:list(env.TRUST_PROXY),
 dbFile:resolve(env.SQLITE_PATH??'../../var/kku-development.sqlite'),devLogin:env.DEV_LOGIN==='1',googleId:env.GOOGLE_CLIENT_ID??'',googleSecret:env.GOOGLE_CLIENT_SECRET??'',allowedDomains:list(env.ALLOWED_GOOGLE_DOMAINS??'kkumail.com,kku.ac.th'),allowPublicGoogle:env.ALLOW_PUBLIC_GOOGLE==='1',bootstrapAdmins:list(env.BOOTSTRAP_ADMIN_EMAILS),
 databaseUrl:env.DATABASE_URL??'',databaseCa:env.DATABASE_CA_PATH||undefined,databaseCaPem:env.DATABASE_CA_PEM?.replace(/\\n/g,'\n'),
 smtpHost:env.SMTP_HOST??'',smtpPort:z.coerce.number().int().min(1).max(65535).parse(env.SMTP_PORT??587),smtpSecure:env.SMTP_SECURE==='1',smtpUser:env.SMTP_USER??'',smtpPassword:env.SMTP_PASSWORD??'',mailFrom:env.MAIL_FROM??'',
 geminiApiKey:env.GEMINI_API_KEY?.trim()??'',geminiModel:env.GEMINI_MODEL?.trim()||'gemini-3.5-flash-lite',assistantDailyLimit:z.coerce.number().int().min(0).max(10000).parse(env.ASSISTANT_DAILY_LIMIT??100)};
 for(const proxy of config.trustProxy) {
  if(proxy==='loopback')continue;
  const [address,prefix,...rest]=proxy.split('/'),version=isIP(address);
  if(!version||rest.length||prefix!==undefined&&(!/^\d+$/.test(prefix)||Number(prefix)>(version===4?32:128)))throw new Error('TRUST_PROXY requires explicit IP/CIDR or loopback');
  if(prefix==='0')throw new Error('TRUST_PROXY must not trust the entire internet');
 }
 if(config.devLogin&&(production||!['127.0.0.1','localhost','::1'].includes(config.host))) throw new Error('DEV_LOGIN is allowed only in non-production bound to loopback');
 if(production) {
  if(origin.protocol!=='https:') throw new Error('Production APP_ORIGIN requires HTTPS');
  if(store!=='postgres') throw new Error('SQLite is a local verification store, not the production database');
  if(!config.databaseUrl) throw new Error('Missing production configuration: databaseUrl');
  if(!config.allowedDomains.length&&!config.allowPublicGoogle) throw new Error('Set verified university domains or explicitly ALLOW_PUBLIC_GOOGLE');
  if(serverless) {
   if(config.cronSecret.length<32||config.rateLimitSecret.length<32)throw new Error('Missing production configuration: CRON_SECRET and RATE_LIMIT_SECRET must be at least 32 characters');
   if(config.databaseCa)throw new Error('Missing production configuration: use DATABASE_CA_PEM instead of a local DATABASE_CA_PATH on Vercel');
  }
 }
 return config;
}
