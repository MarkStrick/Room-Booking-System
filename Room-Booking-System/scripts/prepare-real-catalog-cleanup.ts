// One-time, user-authorized reset of the catalogs installed before the real CP rooms.
// Produces a private backup and guarded maintenance SQL; never deletes through the app role.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readConfig } from '../apps/backend/src/common/config';
import { PostgresStore, tableIdentifier } from '../apps/backend/src/infrastructure/postgres-store';

const catalog = JSON.parse(await readFile(new URL('../docs/data/computing-rooms-2026-10-15.json', import.meta.url), 'utf8')) as { rooms: { code: string }[] };
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const codes = catalog.rooms.map(r => quote(r.code)).join(',');
const samples = JSON.parse(await readFile(new URL('../docs/data/sample-equipment.json', import.meta.url), 'utf8')) as { equipment: { name: string }[] };
const equipmentNames = samples.equipment.map(e => quote(e.name)).join(',');
if (catalog.rooms.length !== 28 || new Set(catalog.rooms.map(r => r.code)).size !== 28) throw new Error('Expected the verified 28-room catalog');
const tables = ['rooms', 'buildings', 'equipment', 'bookings', 'notices', 'violations', 'penalties', 'closures', 'inspections', 'messages', 'audit', 'assignments', 'reports', 'attempts', 'outbox'];
const fingerprint = `SELECT md5(coalesce(jsonb_agg(row_data ORDER BY table_name, row_key)::text,'[]')) AS hash FROM (${tables.map(t => `SELECT ${quote(t)} AS table_name,key AS row_key,jsonb_build_object('table',${quote(t)},'key',key,'payload',payload) AS row_data FROM ${tableIdentifier(t)} t`).join(' UNION ALL ')}) snapshot`;
const store = new PostgresStore(readConfig());
const client = await store.pool.connect();
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const snapshot: Record<string, unknown> = {};
  for (const table of tables) snapshot[`kku_private.${table}`] = (await client.query(`SELECT to_jsonb(t) AS row_data FROM ${tableIdentifier(table)} t ORDER BY key`)).rows.map(r => r.row_data);
  const projected = (await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='kku_booking' ORDER BY tablename")).rows;
  for (const { tablename } of projected) {
    if (!/^[a-z_]+$/.test(tablename)) throw new Error('Unexpected table name');
    snapshot[`kku_booking.${tablename}`] = (await client.query(`SELECT to_jsonb(t) AS row_data FROM kku_booking."${tablename}" t`)).rows.map(r => r.row_data);
  }
  const hash = (await client.query<{ hash: string }>(fingerprint)).rows[0].hash;
  await client.query('COMMIT');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `tmp/backups/pre-real-only-${stamp}.json`;
  const sqlPath = 'tmp/backups/real-catalog-cleanup.sql';
  await mkdir('tmp/backups', { recursive: true });
  await writeFile(backup, JSON.stringify({ createdAt: stamp, hash, tables: snapshot }), { flag: 'wx', mode: 0o600 });
  const sql = `BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='30s';
SELECT id FROM kku_private.app_lock WHERE id=1 FOR UPDATE;
-- Project once explicitly after the complete maintenance change.
SET LOCAL kku.business_projected='yes';
DO $$ BEGIN
 IF (${fingerprint}) <> ${quote(hash)} THEN RAISE EXCEPTION 'Data changed since backup; prepare a fresh backup'; END IF;
 IF (SELECT count(*) FROM kku_private.rooms WHERE payload->>'code' IN (${codes}))<>28
 OR (SELECT count(*) FROM kku_private.rooms WHERE payload->>'code' NOT IN (${codes}))<>25
 OR EXISTS(SELECT 1 FROM kku_private.rooms WHERE payload->>'code' NOT IN (${codes}) AND payload->>'code' !~ '^(DEMO-[SM][0-9]{2}|KKU-ED-(1507|TEAL)|KKU-ODT-M[13])$')
 OR EXISTS(SELECT 1 FROM kku_private.bookings b JOIN kku_private.rooms r ON r.key=b.room_key WHERE r.payload->>'code' IN (${codes}))
 THEN RAISE EXCEPTION 'Catalog or booking scope changed; review cleanup'; END IF;
END $$;
CREATE TEMP TABLE old_rooms ON COMMIT DROP AS SELECT key::bigint id FROM kku_private.rooms WHERE payload->>'code' NOT IN (${codes});
CREATE TEMP TABLE old_buildings ON COMMIT DROP AS SELECT key::bigint id FROM kku_private.buildings WHERE key NOT IN (SELECT payload->>'buildingId' FROM kku_private.rooms WHERE payload->>'code' IN (${codes}));
CREATE TEMP TABLE old_bookings ON COMMIT DROP AS SELECT key::bigint id FROM kku_private.bookings WHERE room_key::bigint IN (SELECT id FROM old_rooms);
CREATE TEMP TABLE old_equipment ON COMMIT DROP AS SELECT key::bigint id FROM kku_private.equipment WHERE payload->>'name' IN (${equipmentNames});
CREATE TEMP TABLE old_notices ON COMMIT DROP AS SELECT key::bigint id FROM kku_private.notices WHERE (payload->>'bookingId')::bigint IN (SELECT id FROM old_bookings);
CREATE TEMP TABLE old_audit ON COMMIT DROP AS SELECT key::bigint id FROM kku_private.audit a WHERE (a.payload->>'bookingId')::bigint IN (SELECT id FROM old_bookings)
 OR EXISTS(SELECT 1 FROM kku_private.rooms r WHERE r.key::bigint IN (SELECT id FROM old_rooms) AND (position(r.payload->>'name' in a.payload->>'text')>0 OR position(r.payload->>'code' in a.payload->>'text')>0))
 OR EXISTS(SELECT 1 FROM kku_private.buildings b WHERE b.key::bigint IN (SELECT id FROM old_buildings) AND position(b.payload->>'name' in a.payload->>'text')>0)
 OR EXISTS(SELECT 1 FROM kku_private.equipment e WHERE e.key::bigint IN (SELECT id FROM old_equipment) AND position(e.payload->>'name' in a.payload->>'text')>0);
CREATE TEMP TABLE old_reports ON COMMIT DROP AS SELECT key::bigint id FROM kku_private.reports p WHERE (payload->>'buildingId')::bigint IN (SELECT id FROM old_buildings) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.payload->'roomIds') r(id) WHERE r.id::bigint IN (SELECT id FROM old_rooms));
DELETE FROM kku_private.outbox WHERE (payload->>'noticeId')::bigint IN (SELECT id FROM old_notices);
DELETE FROM kku_private.attempts WHERE (payload->>'bookingId')::bigint IN (SELECT id FROM old_bookings);
DELETE FROM kku_private.notices WHERE key::bigint IN (SELECT id FROM old_notices);
DELETE FROM kku_private.violations WHERE (payload->>'bookingId')::bigint IN (SELECT id FROM old_bookings);
DELETE FROM kku_private.audit WHERE key::bigint IN (SELECT id FROM old_audit);
-- Only this maintenance transaction may remove the obsolete immutable report snapshot.
ALTER TABLE kku_private.reports DISABLE TRIGGER protect_saved_report;
DELETE FROM kku_private.reports WHERE key::bigint IN (SELECT id FROM old_reports);
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE kku_private.reports ENABLE TRIGGER protect_saved_report;
DELETE FROM kku_private.inspections WHERE (payload->>'roomId')::bigint IN (SELECT id FROM old_rooms);
DELETE FROM kku_private.closures WHERE (payload->>'roomId')::bigint IN (SELECT id FROM old_rooms);
UPDATE kku_private.assignments a SET payload=jsonb_set(a.payload,'{roomIds}',coalesce((SELECT jsonb_agg(r) FROM jsonb_array_elements(a.payload->'roomIds') r WHERE r::text::bigint NOT IN (SELECT id FROM old_rooms)),'[]'::jsonb));
DELETE FROM kku_private.assignments WHERE jsonb_array_length(payload->'roomIds')=0;
DELETE FROM kku_private.bookings WHERE key::bigint IN (SELECT id FROM old_bookings);
DELETE FROM kku_private.rooms WHERE key::bigint IN (SELECT id FROM old_rooms);
DELETE FROM kku_private.buildings WHERE key::bigint IN (SELECT id FROM old_buildings);
DELETE FROM kku_private.equipment WHERE key::bigint IN (SELECT id FROM old_equipment);
-- Remove the corresponding read-model rows too, rather than leaving archived examples.
DELETE FROM kku_booking.notification WHERE notification_id IN (SELECT id FROM old_notices) OR booking_booking_id IN (SELECT id FROM old_bookings);
DELETE FROM kku_booking.booking_log WHERE booking_log_id IN (SELECT id FROM old_audit) OR booking_booking_id IN (SELECT id FROM old_bookings);
DELETE FROM kku_booking.penalty WHERE booking_booking_id IN (SELECT id FROM old_bookings);
DELETE FROM kku_booking.report WHERE report_id IN (SELECT id FROM old_reports);
DELETE FROM kku_booking.booking_equipment WHERE booking_booking_id IN (SELECT id FROM old_bookings);
DELETE FROM kku_booking.booking_participant WHERE booking_booking_id IN (SELECT id FROM old_bookings);
DELETE FROM kku_booking.booking WHERE booking_id IN (SELECT id FROM old_bookings);
DELETE FROM kku_booking.room_assignment WHERE room_room_id IN (SELECT id FROM old_rooms);
DELETE FROM kku_booking.room_equipment WHERE room_room_id IN (SELECT id FROM old_rooms);
DELETE FROM kku_booking.room WHERE room_id IN (SELECT id FROM old_rooms);
DELETE FROM kku_booking.floor WHERE building_building_id IN (SELECT id FROM old_buildings);
DELETE FROM kku_booking.building WHERE building_id IN (SELECT id FROM old_buildings);
DELETE FROM kku_booking.equipment e WHERE (equipment_id IN (SELECT 'loan:'||id FROM old_equipment) OR EXISTS(SELECT 1 FROM old_rooms r WHERE equipment_id LIKE 'room:'||r.id||':%')) AND NOT EXISTS(SELECT 1 FROM kku_booking.room_equipment re WHERE re.equipment_equipment_id=e.equipment_id);
DELETE FROM kku_booking.room_type t WHERE NOT EXISTS(SELECT 1 FROM kku_booking.room r WHERE r.room_type_room_type_id=t.room_type_id);
INSERT INTO kku_private.audit(key,payload)
SELECT next_id::text,jsonb_build_object('id',next_id,'actorId',key::int,'at',to_char(current_timestamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'actionType','REAL_CATALOG_CLEANUP','text','ลบชุดข้อมูลก่อนนำเข้าห้องจริงตามคำขอเจ้าของระบบ เหลือ 28 ห้องใน SC.09 และ SC.06; สำรองข้อมูลก่อนลบแล้ว')
FROM kku_private.users CROSS JOIN (SELECT greatest(coalesce((SELECT max(key::int) FROM kku_private.audit),0),coalesce((SELECT max(booking_log_id) FROM kku_booking.booking_log),0))+1 next_id) n
WHERE lower(payload->>'email')='kittiphon.su@kkumail.com' AND payload->>'role'='ADMIN' AND payload->>'active'='true';
SELECT kku_booking.sync_from_commands();
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ BEGIN
 IF (SELECT count(*) FROM kku_private.rooms)<>28 OR (SELECT count(*) FROM kku_private.buildings)<>2
 OR (SELECT count(*) FROM kku_booking.room)<>28 OR (SELECT count(*) FROM kku_booking.building)<>2
 THEN RAISE EXCEPTION 'Cleanup verification failed'; END IF;
END $$;
COMMIT;
SELECT (SELECT count(*) FROM kku_private.rooms) rooms,(SELECT count(*) FROM kku_private.buildings) buildings,(SELECT count(*) FROM kku_private.bookings) bookings,(SELECT count(*) FROM kku_private.equipment) loan_equipment;
`;
  await writeFile(sqlPath, sql, { mode: 0o600 });
  console.log(JSON.stringify({ backup, sqlPath, backedUpTables: Object.keys(snapshot).length }));
} catch (error) {
  await client.query('ROLLBACK'); throw error;
} finally {
  client.release(); await store.close();
}
