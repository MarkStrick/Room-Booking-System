-- Additive schema for this application. Run on the NEW Supabase project.
-- Never run the original Oracle scripts here. This does not import old data.
BEGIN;
CREATE SCHEMA IF NOT EXISTS kku_private;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path=kku_private,extensions,public;
CREATE TABLE IF NOT EXISTS kku_private.app_lock(id integer PRIMARY KEY CHECK(id=1));
INSERT INTO kku_private.app_lock(id) VALUES(1) ON CONFLICT DO NOTHING;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['users','buildings','rooms','equipment','notices','violations','penalties','closures','inspections','messages','audit','holidays','assignments','identities','sessions','attempts','outbox','flows'] LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS kku_private.%I(key text PRIMARY KEY, payload jsonb NOT NULL)',t);
 END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS kku_private.bookings (
 key text PRIMARY KEY,
 payload jsonb NOT NULL,
 user_key text NOT NULL REFERENCES kku_private.users(key),
 room_key text NOT NULL REFERENCES kku_private.rooms(key),
 start_at timestamptz NOT NULL,
 end_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN('PENDING','APPROVED','REJECTED','CANCELLED','CHECKED_IN','COMPLETED','NO_SHOW')),
 CHECK(end_at-start_at BETWEEN interval '30 minutes' AND interval '4 hours'),
 CHECK((payload->>'id')=key AND (payload->>'roomId')=room_key AND (payload->>'userId')=user_key AND (payload->>'status')=status),
 CONSTRAINT booking_no_overlap EXCLUDE USING gist (room_key WITH =, tstzrange(start_at,end_at,'[)') WITH &&)
 WHERE(status IN('PENDING','APPROVED','CHECKED_IN'))
);
CREATE INDEX IF NOT EXISTS bookings_owner_time ON kku_private.bookings(user_key,start_at DESC);
CREATE INDEX IF NOT EXISTS bookings_room_time ON kku_private.bookings(room_key,start_at);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON kku_private.users(lower(payload->>'email'));
CREATE UNIQUE INDEX IF NOT EXISTS rooms_code_unique ON kku_private.rooms(lower(payload->>'code'));
CREATE UNIQUE INDEX IF NOT EXISTS violations_once ON kku_private.violations((payload->>'bookingId'),(payload->>'type'));
CREATE INDEX IF NOT EXISTS sessions_expiry ON kku_private.sessions((payload->>'expiresAt'));
CREATE INDEX IF NOT EXISTS outbox_status ON kku_private.outbox((payload->>'status'),(payload->>'nextAt'));
REVOKE ALL ON SCHEMA kku_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA kku_private FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kku_private REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
DO $$
DECLARE t text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='kku_private' LOOP
  EXECUTE format('ALTER TABLE kku_private.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
-- There are intentionally NO browser RLS policies. Only the server database
-- owner/service database role can access this schema. Never expose it in Data API.
COMMIT;
