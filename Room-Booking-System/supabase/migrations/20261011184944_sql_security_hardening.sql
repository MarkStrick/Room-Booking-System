-- Additive hardening. Apply after audit_settings, as the migration administrator.
-- Existing invalid rows abort this transaction; never silently repair stock/auth.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE t text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='kku_private' AND tablename NOT IN ('app_lock','holidays') LOOP
  EXECUTE format('ALTER TABLE kku_private.%I ADD CONSTRAINT payload_object CHECK (jsonb_typeof(payload) = ''object'')',t);
 END LOOP;
 FOR t IN SELECT unnest(ARRAY['users','buildings','rooms','equipment','bookings','notices','violations','penalties','closures','inspections','messages','audit']) LOOP
  EXECUTE format('ALTER TABLE kku_private.%I ADD CONSTRAINT payload_identity CHECK ((jsonb_typeof(payload->''id'') = ''number'' AND payload->>''id'' = key AND key ~ ''^[1-9][0-9]*$'') IS TRUE)',t);
 END LOOP;
END $$;

ALTER TABLE kku_private.users ADD CONSTRAINT users_required CHECK ((
 jsonb_typeof(payload->'email')='string' AND length(btrim(payload->>'email')) BETWEEN 3 AND 254
 AND payload->>'email'=btrim(payload->>'email')
 AND payload->>'role' IN ('USER','STAFF','ADMIN') AND jsonb_typeof(payload->'active')='boolean'
) IS TRUE);
ALTER TABLE kku_private.buildings ADD CONSTRAINT buildings_floors CHECK ((
 jsonb_typeof(payload->'floors')='number' AND (payload->>'floors')::numeric BETWEEN 1 AND 2147483647
 AND (payload->>'floors')::numeric=trunc((payload->>'floors')::numeric)
) IS TRUE);
ALTER TABLE kku_private.rooms ADD CONSTRAINT rooms_required CHECK ((
 jsonb_typeof(payload->'code')='string' AND length(btrim(payload->>'code')) BETWEEN 1 AND 30
 AND jsonb_typeof(payload->'capacity')='number' AND (payload->>'capacity')::numeric BETWEEN 1 AND 2147483647
 AND (payload->>'capacity')::numeric=trunc((payload->>'capacity')::numeric)
 AND payload->>'status' IN ('AVAILABLE','MAINTENANCE','CLOSED')
 AND jsonb_typeof(payload->'floor')='number' AND (payload->>'floor')::numeric>=1
 AND (payload->>'floor')::numeric=trunc((payload->>'floor')::numeric)
) IS TRUE);
ALTER TABLE kku_private.rooms ADD COLUMN building_key text GENERATED ALWAYS AS (payload->>'buildingId') STORED NOT NULL;
ALTER TABLE kku_private.rooms ADD CONSTRAINT rooms_building_fk FOREIGN KEY(building_key) REFERENCES kku_private.buildings(key);
CREATE INDEX rooms_building ON kku_private.rooms(building_key);
ALTER TABLE kku_private.equipment ADD CONSTRAINT equipment_quantities CHECK ((
 jsonb_typeof(payload->'total')='number' AND jsonb_typeof(payload->'remaining')='number'
 AND (payload->>'total')::numeric BETWEEN 0 AND 100000
 AND (payload->>'remaining')::numeric BETWEEN 0 AND (payload->>'total')::numeric
 AND (payload->>'total')::numeric=trunc((payload->>'total')::numeric)
 AND (payload->>'remaining')::numeric=trunc((payload->>'remaining')::numeric)
) IS TRUE);
ALTER TABLE kku_private.bookings ADD CONSTRAINT bookings_required CHECK ((
 payload->>'roomId'=room_key AND payload->>'userId'=user_key AND payload->>'status'=status
 AND jsonb_typeof(payload->'start')='string' AND (payload->>'start')::timestamptz=start_at
 AND jsonb_typeof(payload->'end')='string' AND (payload->>'end')::timestamptz=end_at
 AND jsonb_typeof(payload->'attendees')='number' AND (payload->>'attendees')::numeric BETWEEN 1 AND 2147483647
 AND (payload->>'attendees')::numeric=trunc((payload->>'attendees')::numeric)
) IS TRUE);
ALTER TABLE kku_private.credentials ADD CONSTRAINT credentials_required CHECK ((
 payload->>'userId'=key AND jsonb_typeof(payload->'passwordHash')='string'
 AND payload->>'passwordHash' LIKE '$argon2id$%'
) IS TRUE);
ALTER TABLE kku_private.password_tokens ADD CONSTRAINT password_tokens_required CHECK ((
 payload->>'tokenHash'=key AND payload->>'kind' IN ('register','reset')
 AND jsonb_typeof(payload->'expiresAt')='string' AND jsonb_typeof(payload->'email')='string'
 AND (payload->>'kind'<>'register' OR (jsonb_typeof(payload->'passwordHash')='string' AND payload->>'passwordHash' LIKE '$argon2id$%'))
) IS TRUE);

CREATE FUNCTION kku_private.guard_booking_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.status<>OLD.status AND NOT (
  (OLD.status='PENDING' AND NEW.status IN ('APPROVED','REJECTED','CANCELLED')) OR
  (OLD.status='APPROVED' AND NEW.status IN ('CHECKED_IN','CANCELLED','NO_SHOW')) OR
  (OLD.status='CHECKED_IN' AND NEW.status='COMPLETED')
 ) THEN
  RAISE EXCEPTION 'Invalid booking state transition' USING ERRCODE='23514';
 END IF;
 IF NEW.user_key<>OLD.user_key OR NEW.room_key<>OLD.room_key THEN
  RAISE EXCEPTION 'Booking owner and room cannot be reassigned' USING ERRCODE='23514';
 END IF;
 IF NEW.start_at<>OLD.start_at OR NEW.end_at<>OLD.end_at THEN
  RAISE EXCEPTION 'Cancel and create a new booking to change its slot' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_booking_transition BEFORE UPDATE ON kku_private.bookings
FOR EACH ROW EXECUTE FUNCTION kku_private.guard_booking_transition();
REVOKE ALL ON FUNCTION kku_private.guard_booking_transition() FROM PUBLIC,anon,authenticated;

-- The application authenticates in NestJS; its database role needs all app rows.
-- It must not own tables, disable RLS, TRUNCATE or perform schema DDL.
DO $$
DECLARE t text;
BEGIN
 IF current_user='kku_server' THEN RAISE EXCEPTION 'Run migration as administrator, not kku_server'; END IF;
 EXECUTE format('ALTER SCHEMA kku_private OWNER TO %I',current_user);
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='kku_private' LOOP
  EXECUTE format('ALTER TABLE kku_private.%I OWNER TO %I',t,current_user);
  EXECUTE format('ALTER TABLE kku_private.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kku_server') THEN
  -- Supabase's managed administrator cannot alter SUPERUSER attributes.
  -- Refuse an unsafe role; the existing runtime already has all flags disabled.
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kku_server' AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
   RAISE EXCEPTION 'Provision kku_server without elevated role privileges before migration';
  END IF;
  ALTER ROLE kku_server SET search_path=pg_catalog;
  ALTER ROLE kku_server SET statement_timeout='30s';
  ALTER ROLE kku_server SET lock_timeout='10s';
  ALTER ROLE kku_server SET idle_in_transaction_session_timeout='30s';
  REVOKE ALL ON SCHEMA kku_private FROM kku_server;
  REVOKE ALL ON ALL TABLES IN SCHEMA kku_private FROM kku_server;
  GRANT USAGE ON SCHEMA kku_private TO kku_server;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='kku_private' LOOP
   IF t='app_lock' THEN
    EXECUTE format('GRANT SELECT,UPDATE ON kku_private.%I TO kku_server',t);
   ELSE
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON kku_private.%I TO kku_server',t);
   END IF;
   EXECUTE format('CREATE POLICY server_access ON kku_private.%I TO kku_server USING (true) WITH CHECK (true)',t);
  END LOOP;
  GRANT EXECUTE ON FUNCTION kku_private.guard_booking_transition() TO kku_server;
  ALTER DEFAULT PRIVILEGES FOR ROLE kku_server IN SCHEMA kku_private REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
  ALTER DEFAULT PRIVILEGES FOR ROLE kku_server IN SCHEMA kku_private REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
 END IF;
END $$;
REVOKE ALL ON SCHEMA kku_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA kku_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA kku_private FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kku_private REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kku_private REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
COMMIT;
