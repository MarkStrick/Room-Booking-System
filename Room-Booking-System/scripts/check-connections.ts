// Read-only diagnostics. Never print configuration values or provider errors:
// connection errors may contain database passwords, SMTP usernames or tokens.
import nodemailer from 'nodemailer';
import { PostgresStore, tables } from '../apps/backend/src/infrastructure/postgres-store';

let failures = 0;
function result(service: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'OK' : 'WAIT'} ${service}: ${detail}`);
  if (!ok) failures++;
}
function configured(...keys: string[]) { return keys.every(key => !!process.env[key]?.trim()); }

const env = process.env;
let origin: URL | undefined;
try {
  const candidate = new URL(env.APP_ORIGIN ?? '');
  if (candidate.username || candidate.password || candidate.search || candidate.hash || candidate.pathname !== '/') throw new Error();
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(candidate.hostname);
  if (candidate.protocol !== 'https:' && !(candidate.protocol === 'http:' && local && env.NODE_ENV !== 'production')) throw new Error();
  origin = candidate;
  result('Web origin', true, local ? 'local development URL; public hosting still required' : 'valid HTTPS URL; hosting reachability not tested');
} catch { result('Web origin', false, 'set APP_ORIGIN to an HTTPS origin (loopback HTTP permitted for development)'); }

if (!configured('DATABASE_URL')) result('Supabase PostgreSQL', false, 'set DATABASE_URL from Supabase Connect; an API key is not a database connection string');
else {
  let store: PostgresStore | undefined;
  try {
    store = new PostgresStore({ databaseUrl: env.DATABASE_URL, databaseCa: env.DATABASE_CA_PATH || undefined });
    const client = await store.pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query("SET LOCAL statement_timeout='10s'");
      const schema = await client.query<{ name: string; rls: boolean; readable: boolean; writable: boolean; serverAccess: boolean }>(`
        SELECT c.relname AS name, c.relrowsecurity AS rls,
          has_table_privilege(c.oid, 'SELECT') AS readable,
          (has_table_privilege(c.oid, 'INSERT') AND has_table_privilege(c.oid, 'UPDATE')
            AND has_table_privilege(c.oid, 'DELETE')) AS writable,
          (r.rolbypassrls OR NOT c.relrowsecurity OR
            (pg_has_role(current_user, c.relowner, 'USAGE') AND NOT c.relforcerowsecurity)) AS "serverAccess"
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_roles r ON r.rolname=current_user
        WHERE n.nspname='kku_private' AND c.relkind='r'`);
      const expected = [...tables, 'app_lock'];
      const rows = new Map(schema.rows.map(row => [row.name, row]));
      const missing = expected.filter(name => !rows.has(name));
      const unsafe = tables.filter(name => rows.has(name) && !rows.get(name)!.rls);
      const inaccessible = expected.filter(name => rows.has(name) && (!rows.get(name)!.readable || !rows.get(name)!.writable || !rows.get(name)!.serverAccess));
      result('Database TLS', true, 'connected with certificate verification');
      result('Database schema', !missing.length && !unsafe.length && !inaccessible.length,
        missing.length ? `missing ${missing.length} tables; apply both supabase/migrations scripts` :
        unsafe.length ? 'application tables missing row level security' :
        inaccessible.length ? 'server database role lacks table permissions or access through RLS' :
        'all 22 application tables present, application RLS enabled and server table permissions available; booking flow still needs testing');
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  } catch { result('Supabase PostgreSQL', false, 'connection failed; check database password, network access, CA certificate and database role'); }
  finally { await store?.close(); }
}

if (!configured('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')) result('Google Login', false, 'set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for a Web application OAuth client');
else {
  try {
    const response = await fetch('https://accounts.google.com/.well-known/openid-configuration', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error();
    const metadata = await response.json() as { issuer?: string };
    if (metadata.issuer !== 'https://accounts.google.com') throw new Error();
    result('Google discovery', true, 'Google identity service reachable; client credentials and user login are NOT verified by discovery');
    result('Google callback', !!origin, origin ? `register ${origin.origin}/api/auth/google/callback in Google Cloud, then test a real login` : 'APP_ORIGIN is invalid');
  } catch { result('Google Login', false, 'Google identity service unavailable; retry after checking network connectivity'); }
}

if (!configured('SMTP_HOST', 'MAIL_FROM')) result('Email', false, 'set SMTP_HOST and MAIL_FROM, plus credentials required by your email provider');
else {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port: Number(env.SMTP_PORT ?? 587),
    secure: env.SMTP_SECURE === '1', requireTLS: env.SMTP_SECURE !== '1',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  try {
    await transport.verify();
    result('SMTP', true, 'TLS connection and SMTP authentication verified; no email sent, sender authorization and inbox delivery still need testing');
  } catch { result('SMTP', false, 'check host, port, TLS setting and SMTP credentials'); }
  finally { transport.close(); }
}
result('Application database mode', env.DB_DRIVER === 'postgres', 'set DB_DRIVER=postgres when the Supabase schema is ready');
result('Production login', env.DEV_LOGIN !== '1', 'set DEV_LOGIN=0 before allowing real users');
console.log('This check does not migrate data, create accounts, send emails or verify an end-to-end booking.');
process.exitCode = failures ? 1 : 0;
