-- Term Project PDF, sections 2-4. PostgreSQL equivalent of the 18 Oracle entities.
-- Existing payloads remain compatible with the running website. Deferred triggers
-- maintain typed relational records in the SAME transaction, including direct SQL
-- writes. A constraint failure rolls back the payload, stock, logs and outbox.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
CREATE SCHEMA kku_booking;
CREATE TABLE kku_private.reports(key text PRIMARY KEY,payload jsonb NOT NULL);

-- Historical creation/edit times were not recorded for every old entity. For
-- those rows these timestamps start at migration, never pretend to be original.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['users','buildings','rooms','equipment','bookings','notices','penalties','audit','reports']) LOOP
  EXECUTE format('ALTER TABLE kku_private.%I ADD COLUMN created_at timestamptz NOT NULL DEFAULT current_timestamp, ADD COLUMN updated_at timestamptz NOT NULL DEFAULT current_timestamp, ADD COLUMN deleted_at timestamptz',t);
 END LOOP;
END $$;
CREATE FUNCTION kku_private.stamp_business_row() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' THEN NEW.created_at=OLD.created_at; END IF;
 NEW.updated_at=current_timestamp;
 IF NEW.payload->>'active'='false' THEN
  NEW.deleted_at=coalesce(NEW.deleted_at,current_timestamp);
 ELSE NEW.deleted_at=NULL; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['users','buildings','rooms','equipment','bookings','notices','penalties','audit','reports']) LOOP
  EXECUTE format('CREATE TRIGGER stamp_business_row BEFORE INSERT OR UPDATE ON kku_private.%I FOR EACH ROW EXECUTE FUNCTION kku_private.stamp_business_row()',t);
  EXECUTE format('UPDATE kku_private.%I SET deleted_at=current_timestamp WHERE payload->>''active''=''false''',t);
 END LOOP;
END $$;
CREATE FUNCTION kku_private.protect_saved_report() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 RAISE EXCEPTION 'Saved reports are immutable; save a new snapshot' USING ERRCODE='23514';
END $$;
CREATE TRIGGER protect_saved_report BEFORE UPDATE OR DELETE ON kku_private.reports FOR EACH ROW EXECUTE FUNCTION kku_private.protect_saved_report();
ALTER TABLE kku_private.reports ADD CONSTRAINT reports_payload CHECK((jsonb_typeof(payload)='object' AND jsonb_typeof(payload->'id')='number' AND payload->>'id'=key) IS TRUE);

CREATE TABLE kku_booking.affiliation(
 affiliation_id text PRIMARY KEY, affiliation_name text NOT NULL UNIQUE CHECK(length(btrim(affiliation_name))>0));
CREATE TABLE kku_booking.users(
 user_id bigint PRIMARY KEY,full_name text NOT NULL CHECK(length(btrim(full_name))>0),
 email text NOT NULL,phone text,role_level text NOT NULL CHECK(role_level IN ('USER','STAFF','ADMIN')),
 account_status text NOT NULL CHECK(account_status IN ('ACTIVE','INACTIVE')),
 affiliation_affiliation_id text REFERENCES kku_booking.affiliation ON DELETE RESTRICT,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 is_deleted boolean NOT NULL DEFAULT false,deleted_at timestamptz,
 CHECK(is_deleted=(deleted_at IS NOT NULL)));
CREATE UNIQUE INDEX users_email_unique ON kku_booking.users(lower(email));
CREATE TABLE kku_booking.staff(
 staff_id bigint PRIMARY KEY,users_user_id bigint NOT NULL UNIQUE REFERENCES kku_booking.users ON DELETE RESTRICT,
 job_title text NOT NULL, start_date date,staff_status text NOT NULL CHECK(staff_status IN ('ACTIVE','INACTIVE')));
CREATE TABLE kku_booking.building(
 building_id bigint PRIMARY KEY,building_name text NOT NULL CHECK(length(btrim(building_name))>0),address text,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,is_deleted boolean NOT NULL,deleted_at timestamptz);
CREATE TABLE kku_booking.floor(
 floor_id text PRIMARY KEY,floor_number integer NOT NULL CHECK(floor_number>0),floor_name text NOT NULL,
 building_building_id bigint NOT NULL REFERENCES kku_booking.building ON DELETE RESTRICT,
 UNIQUE(building_building_id,floor_number));
CREATE TABLE kku_booking.room_type(
 room_type_id text PRIMARY KEY,type_name text NOT NULL UNIQUE CHECK(length(btrim(type_name))>0),description text);
CREATE TABLE kku_booking.room(
 room_id bigint PRIMARY KEY,room_code text NOT NULL UNIQUE,room_name text NOT NULL CHECK(length(btrim(room_name))>0),
 capacity integer NOT NULL CHECK(capacity>0),room_status text NOT NULL CHECK(room_status IN ('AVAILABLE','MAINTENANCE','CLOSED')),
 image_url text,floor_floor_id text NOT NULL REFERENCES kku_booking.floor ON DELETE RESTRICT,
 room_type_room_type_id text NOT NULL REFERENCES kku_booking.room_type ON DELETE RESTRICT,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,is_deleted boolean NOT NULL,deleted_at timestamptz);
CREATE TABLE kku_booking.equipment(
 equipment_id text PRIMARY KEY,equipment_name text NOT NULL CHECK(length(btrim(equipment_name))>0),
 equipment_type text NOT NULL CHECK(equipment_type IN ('LOAN','INSTALLED')),
 equipment_status text NOT NULL CHECK(equipment_status IN ('AVAILABLE','INACTIVE','DAMAGED')),
 total_qty integer NOT NULL CHECK(total_qty>=0),remaining_qty integer NOT NULL CHECK(remaining_qty>=0 AND remaining_qty<=total_qty),
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 created_by_user_id bigint REFERENCES kku_booking.users ON DELETE RESTRICT,
 is_deleted boolean NOT NULL,deleted_at timestamptz);
CREATE TABLE kku_booking.booking(
 booking_id bigint PRIMARY KEY,booking_ref text NOT NULL UNIQUE,booking_date date NOT NULL,
 start_time timestamptz NOT NULL,end_time timestamptz NOT NULL CHECK(end_time>start_time),purpose text NOT NULL,
 booking_status text NOT NULL CHECK(booking_status IN ('PENDING','APPROVED','REJECTED','CANCELLED','CHECKED_IN','COMPLETED','NO_SHOW')),
 actual_checkin_time timestamptz,users_user_id bigint NOT NULL REFERENCES kku_booking.users ON DELETE RESTRICT,
 room_room_id bigint NOT NULL REFERENCES kku_booking.room ON DELETE RESTRICT,
 staff_staff_id bigint REFERENCES kku_booking.staff ON DELETE RESTRICT,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,approved_at timestamptz,reject_reason text,
 attendees integer NOT NULL CHECK(attendees>0),archived_at timestamptz,
 CHECK((staff_staff_id IS NULL)=(approved_at IS NULL)),
 CHECK(booking_status NOT IN ('APPROVED','CHECKED_IN','COMPLETED','NO_SHOW','REJECTED') OR staff_staff_id IS NOT NULL));
CREATE INDEX idx_booking_availability ON kku_booking.booking(room_room_id,start_time,end_time);
CREATE INDEX idx_booking_user_history ON kku_booking.booking(users_user_id,created_at DESC);
CREATE TABLE kku_booking.booking_equipment(
 booking_booking_id bigint NOT NULL REFERENCES kku_booking.booking ON DELETE CASCADE,
 equipment_equipment_id text NOT NULL REFERENCES kku_booking.equipment ON DELETE RESTRICT,
 borrowed_qty integer NOT NULL CHECK(borrowed_qty>0),issued_qty integer NOT NULL DEFAULT 0,
 returned_qty integer NOT NULL DEFAULT 0,
 PRIMARY KEY(booking_booking_id,equipment_equipment_id),
 CHECK(issued_qty BETWEEN 0 AND borrowed_qty AND returned_qty BETWEEN 0 AND issued_qty));
CREATE TABLE kku_booking.booking_participant(
 booking_booking_id bigint NOT NULL REFERENCES kku_booking.booking ON DELETE CASCADE,
 participant_email text NOT NULL CHECK(length(participant_email)>3),
 users_user_id bigint REFERENCES kku_booking.users ON DELETE RESTRICT,
 participation_status text NOT NULL CHECK(participation_status IN ('REGISTERED','DECLARED')),
 PRIMARY KEY(booking_booking_id,participant_email));
CREATE TABLE kku_booking.room_equipment(
 room_room_id bigint NOT NULL REFERENCES kku_booking.room ON DELETE RESTRICT,
 equipment_equipment_id text NOT NULL REFERENCES kku_booking.equipment ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK(quantity>0),damaged_qty integer NOT NULL CHECK(damaged_qty BETWEEN 0 AND quantity),
 equip_status text NOT NULL CHECK(equip_status IN ('AVAILABLE','DAMAGED')),
 PRIMARY KEY(room_room_id,equipment_equipment_id));
CREATE TABLE kku_booking.room_assignment(
 staff_staff_id bigint NOT NULL REFERENCES kku_booking.staff ON DELETE RESTRICT,
 room_room_id bigint NOT NULL REFERENCES kku_booking.room ON DELETE RESTRICT,
 start_date date,end_date date,work_shift text,
 PRIMARY KEY(staff_staff_id,room_room_id),CHECK(end_date>=start_date));
CREATE SEQUENCE kku_booking.booking_log_seq;
CREATE TABLE kku_booking.booking_log(
 booking_log_id bigint PRIMARY KEY DEFAULT nextval('kku_booking.booking_log_seq'),
 action_type text NOT NULL,action_time timestamptz NOT NULL,violation_flag text NOT NULL CHECK(violation_flag IN ('YES','NO')),
 booking_booking_id bigint REFERENCES kku_booking.booking ON DELETE RESTRICT,
 users_user_id bigint REFERENCES kku_booking.users ON DELETE RESTRICT,
 affected_user_id bigint REFERENCES kku_booking.users ON DELETE RESTRICT,
 actor_type text NOT NULL CHECK(actor_type IN ('USER','SYSTEM')),content text NOT NULL,
 CHECK((actor_type='SYSTEM')=(users_user_id IS NULL)));
CREATE SEQUENCE kku_booking.notification_seq;
CREATE TABLE kku_booking.notification(
 notification_id bigint PRIMARY KEY DEFAULT nextval('kku_booking.notification_seq'),noti_type text NOT NULL,
 content text NOT NULL,recipient_email text NOT NULL,send_time timestamptz,
 booking_booking_id bigint REFERENCES kku_booking.booking ON DELETE RESTRICT,
 users_user_id bigint NOT NULL REFERENCES kku_booking.users ON DELETE RESTRICT,
 template_code text NOT NULL CHECK(length(template_code)>0),params_json jsonb NOT NULL CHECK(jsonb_typeof(params_json)='object'),
 delivery_status text NOT NULL CHECK(delivery_status IN ('QUEUED','SENT','FAILED')),
 created_at timestamptz NOT NULL);
CREATE TABLE kku_booking.penalty(
 penalty_id bigint PRIMARY KEY,penalty_type text NOT NULL CHECK(penalty_type IN ('WARNING','SUSPENSION')),
 start_date date NOT NULL,end_date date NOT NULL CHECK(end_date>=start_date),reason text NOT NULL,
 penalty_status text NOT NULL CHECK(penalty_status IN ('ACTIVE','EXPIRED')),
 users_user_id bigint NOT NULL REFERENCES kku_booking.users ON DELETE RESTRICT,
 staff_staff_id bigint NOT NULL REFERENCES kku_booking.staff ON DELETE RESTRICT,
 booking_booking_id bigint REFERENCES kku_booking.booking ON DELETE RESTRICT,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE kku_booking.holiday(
 holiday_id date PRIMARY KEY,holiday_date date NOT NULL UNIQUE,description text NOT NULL DEFAULT 'วันหยุดมหาวิทยาลัย');
CREATE TABLE kku_booking.report(
 report_id bigint PRIMARY KEY,report_type text NOT NULL CHECK(report_type='ROOM_USAGE'),report_date date NOT NULL,
 users_user_id bigint NOT NULL REFERENCES kku_booking.users ON DELETE RESTRICT,
 from_date date NOT NULL,to_date date NOT NULL CHECK(to_date>=from_date AND to_date-from_date<=366),
 total_bookings integer NOT NULL CHECK(total_bookings>=0),total_hours numeric(12,2) NOT NULL CHECK(total_hours>=0),
 canceled_count integer NOT NULL CHECK(canceled_count BETWEEN 0 AND total_bookings),
 created_at timestamptz NOT NULL);
CREATE INDEX report_owner_date ON kku_booking.report(users_user_id,created_at DESC);

-- Internal projection writer, not a browser RPC. The runtime only writes legacy
-- command tables; normalized tables are read-only to it. This tightly scoped
-- SECURITY DEFINER is necessary for triggers to maintain the relational rows.
CREATE FUNCTION kku_booking.sync_from_commands() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM kku_private.notices n WHERE NOT EXISTS(SELECT 1 FROM kku_private.users u WHERE u.key=n.payload->>'userId')) THEN
  RAISE EXCEPTION 'Notification recipient must reference an existing user' USING ERRCODE='23503';
 END IF;
 IF EXISTS(SELECT 1 FROM kku_private.bookings b CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(b.payload->'participants','[]'::jsonb)) p(id) WHERE NOT EXISTS(SELECT 1 FROM kku_private.users u WHERE u.key=p.id)) THEN
  RAISE EXCEPTION 'Participant must reference an existing user' USING ERRCODE='23503';
 END IF;
 INSERT INTO kku_booking.affiliation SELECT DISTINCT lower(btrim(payload->>'affiliation')),btrim(payload->>'affiliation') FROM kku_private.users WHERE nullif(btrim(payload->>'affiliation'),'') IS NOT NULL ON CONFLICT(affiliation_id) DO NOTHING;
 INSERT INTO kku_booking.users
 SELECT key::bigint,payload->>'name',payload->>'email',payload->>'phone',payload->>'role',CASE WHEN payload->>'active'='false' THEN 'INACTIVE' ELSE 'ACTIVE' END,nullif(lower(btrim(payload->>'affiliation')),''),created_at,updated_at,payload->>'active'='false',deleted_at FROM kku_private.users
 ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,role_level=excluded.role_level,account_status=excluded.account_status,affiliation_affiliation_id=excluded.affiliation_affiliation_id,updated_at=excluded.updated_at,is_deleted=excluded.is_deleted,deleted_at=excluded.deleted_at;
 -- Keep historical staff IDs when a role changes, so past approval FKs survive.
 INSERT INTO kku_booking.staff(staff_id,users_user_id,job_title,staff_status)
 SELECT user_id,user_id,role_level,CASE WHEN role_level IN ('STAFF','ADMIN') AND NOT is_deleted THEN 'ACTIVE' ELSE 'INACTIVE' END FROM kku_booking.users WHERE role_level IN ('STAFF','ADMIN') OR user_id IN (SELECT staff_id FROM kku_booking.staff)
 ON CONFLICT(staff_id) DO UPDATE SET job_title=excluded.job_title,staff_status=excluded.staff_status;
 INSERT INTO kku_booking.building
 SELECT key::bigint,payload->>'name',payload->>'address',created_at,updated_at,coalesce(payload->>'active'='false',false),deleted_at FROM kku_private.buildings
 ON CONFLICT(building_id) DO UPDATE SET building_name=excluded.building_name,address=excluded.address,updated_at=excluded.updated_at,is_deleted=excluded.is_deleted,deleted_at=excluded.deleted_at;
 INSERT INTO kku_booking.floor
 SELECT b.key||':'||f.number,f.number,coalesce((SELECT l->>'name' FROM jsonb_array_elements(coalesce(b.payload->'levels','[]'::jsonb)) l WHERE (l->>'number')::integer=f.number),'ชั้น '||f.number),b.key::bigint FROM kku_private.buildings b CROSS JOIN LATERAL generate_series(1,(b.payload->>'floors')::integer) f(number)
 ON CONFLICT(floor_id) DO UPDATE SET floor_name=excluded.floor_name;
 INSERT INTO kku_booking.room_type SELECT DISTINCT lower(btrim(payload->>'type')),btrim(payload->>'type'),NULL FROM kku_private.rooms ON CONFLICT(room_type_id) DO NOTHING;
 INSERT INTO kku_booking.room
 SELECT key::bigint,payload->>'code',payload->>'name',(payload->>'capacity')::integer,payload->>'status',payload->>'imageUrl',(payload->>'buildingId')||':'||(payload->>'floor'),lower(btrim(payload->>'type')),created_at,updated_at,coalesce(payload->>'active'='false',false),deleted_at FROM kku_private.rooms
 ON CONFLICT(room_id) DO UPDATE SET room_code=excluded.room_code,room_name=excluded.room_name,capacity=excluded.capacity,room_status=excluded.room_status,image_url=excluded.image_url,floor_floor_id=excluded.floor_floor_id,room_type_room_type_id=excluded.room_type_room_type_id,updated_at=excluded.updated_at,is_deleted=excluded.is_deleted,deleted_at=excluded.deleted_at;
 -- Prefixes distinguish loan stock and room-local inventory IDs. A chair with
 -- room-local ID 1 must never silently become loan equipment ID 1.
 INSERT INTO kku_booking.equipment
 SELECT 'loan:'||key,payload->>'name','LOAN',CASE WHEN payload->>'active'='false' THEN 'INACTIVE' ELSE 'AVAILABLE' END,(payload->>'total')::integer,(payload->>'remaining')::integer,created_at,updated_at,(payload->>'createdBy')::bigint,coalesce(payload->>'active'='false',false),deleted_at FROM kku_private.equipment
 ON CONFLICT(equipment_id) DO UPDATE SET equipment_name=excluded.equipment_name,equipment_status=excluded.equipment_status,total_qty=excluded.total_qty,remaining_qty=excluded.remaining_qty,updated_at=excluded.updated_at,is_deleted=excluded.is_deleted,deleted_at=excluded.deleted_at;
 INSERT INTO kku_booking.equipment
 SELECT 'room:'||r.key||':'||(i->>'id'),i->>'name','INSTALLED',CASE WHEN (i->>'damaged')::integer>0 THEN 'DAMAGED' ELSE 'AVAILABLE' END,(i->>'total')::integer,(i->>'total')::integer-(i->>'damaged')::integer,r.created_at,r.updated_at,NULL,coalesce(r.payload->>'active'='false',false),r.deleted_at FROM kku_private.rooms r CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.payload->'inventory','[]'::jsonb)) i
 ON CONFLICT(equipment_id) DO UPDATE SET equipment_name=excluded.equipment_name,equipment_status=excluded.equipment_status,total_qty=excluded.total_qty,remaining_qty=excluded.remaining_qty,updated_at=excluded.updated_at,is_deleted=excluded.is_deleted,deleted_at=excluded.deleted_at;
 INSERT INTO kku_booking.booking
 SELECT key::bigint,payload->>'ref',(start_at AT TIME ZONE 'Asia/Bangkok')::date,start_at,end_at,payload->>'purpose',status,(payload->>'checkedInAt')::timestamptz,user_key::bigint,room_key::bigint,(payload->>'decidedBy')::bigint,(payload->>'createdAt')::timestamptz,updated_at,(payload->>'decidedAt')::timestamptz,payload->>'reason',(payload->>'attendees')::integer,(payload->>'archivedAt')::timestamptz FROM kku_private.bookings
 ON CONFLICT(booking_id) DO UPDATE SET booking_status=excluded.booking_status,actual_checkin_time=excluded.actual_checkin_time,staff_staff_id=excluded.staff_staff_id,updated_at=excluded.updated_at,approved_at=excluded.approved_at,reject_reason=excluded.reject_reason,archived_at=excluded.archived_at;
 DELETE FROM kku_booking.booking_equipment;
 INSERT INTO kku_booking.booking_equipment
 SELECT b.key::bigint,'loan:'||(i->>'id'),(i->>'qty')::integer,coalesce((i->>'issued')::integer,0),coalesce((i->>'returned')::integer,0) FROM kku_private.bookings b CROSS JOIN LATERAL jsonb_array_elements(coalesce(b.payload->'equipment','[]'::jsonb)) i;
 DELETE FROM kku_booking.booking_participant;
 INSERT INTO kku_booking.booking_participant
 SELECT b.key::bigint,lower(e.email),u.user_id,CASE WHEN u.user_id IS NULL THEN 'DECLARED' ELSE 'REGISTERED' END FROM kku_private.bookings b CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(b.payload->'participantEmails','[]'::jsonb)) e(email) LEFT JOIN kku_booking.users u ON lower(u.email)=lower(e.email);
 INSERT INTO kku_booking.booking_participant
 SELECT b.key::bigint,lower(u.email),u.user_id,'REGISTERED' FROM kku_private.bookings b CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(b.payload->'participants','[]'::jsonb)) p(id) JOIN kku_booking.users u ON u.user_id=p.id::bigint ON CONFLICT DO NOTHING;
 DELETE FROM kku_booking.room_equipment;
 INSERT INTO kku_booking.room_equipment
 SELECT r.key::bigint,'room:'||r.key||':'||(i->>'id'),(i->>'total')::integer,(i->>'damaged')::integer,CASE WHEN (i->>'damaged')::integer>0 THEN 'DAMAGED' ELSE 'AVAILABLE' END FROM kku_private.rooms r CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.payload->'inventory','[]'::jsonb)) i;
 DELETE FROM kku_booking.room_assignment;
 INSERT INTO kku_booking.room_assignment
 SELECT (a.payload->>'userId')::bigint,r.id::bigint,(a.payload->>'start')::date,(a.payload->>'end')::date,NULL FROM kku_private.assignments a CROSS JOIN LATERAL jsonb_array_elements_text(a.payload->'roomIds') r(id);
 INSERT INTO kku_booking.booking_log
 SELECT a.key::bigint,coalesce(nullif(a.payload->>'actionType',''),'AUDIT'),(a.payload->>'at')::timestamptz,CASE WHEN EXISTS(SELECT 1 FROM kku_private.violations v WHERE v.payload->>'bookingId'=a.payload->>'bookingId' AND v.payload->>'at'=a.payload->>'at') THEN 'YES' ELSE 'NO' END,(a.payload->>'bookingId')::bigint,(a.payload->>'actorId')::bigint,b.users_user_id,CASE WHEN a.payload->>'actorId' IS NULL THEN 'SYSTEM' ELSE 'USER' END,a.payload->>'text' FROM kku_private.audit a LEFT JOIN kku_booking.booking b ON b.booking_id=(a.payload->>'bookingId')::bigint ON CONFLICT(booking_log_id) DO NOTHING;
 INSERT INTO kku_booking.notification
 SELECT n.key::bigint,'EMAIL',n.payload->>'content',u.email,(n.payload->>'sentAt')::timestamptz,(n.payload->>'bookingId')::bigint,u.user_id,coalesce(nullif(n.payload->>'templateCode',''),'GENERAL'),coalesce(n.payload->'params','{}'::jsonb),n.payload->>'status',(n.payload->>'createdAt')::timestamptz FROM kku_private.notices n JOIN kku_booking.users u ON u.user_id=(n.payload->>'userId')::bigint
 ON CONFLICT(notification_id) DO UPDATE SET send_time=excluded.send_time,delivery_status=excluded.delivery_status;
 INSERT INTO kku_booking.penalty
 SELECT p.key::bigint,p.payload->>'type',(p.payload->>'start')::date,(p.payload->>'end')::date,p.payload->>'reason',CASE WHEN (p.payload->>'end')::date<(current_timestamp AT TIME ZONE 'Asia/Bangkok')::date THEN 'EXPIRED' ELSE 'ACTIVE' END,(p.payload->>'userId')::bigint,(p.payload->>'actorId')::bigint,NULL,(p.payload->>'at')::timestamptz,p.updated_at FROM kku_private.penalties p
 ON CONFLICT(penalty_id) DO UPDATE SET penalty_status=excluded.penalty_status,updated_at=excluded.updated_at;
 DELETE FROM kku_booking.holiday WHERE holiday_id NOT IN (SELECT key::date FROM kku_private.holidays);
 INSERT INTO kku_booking.holiday(holiday_id,holiday_date) SELECT key::date,key::date FROM kku_private.holidays ON CONFLICT DO NOTHING;
 INSERT INTO kku_booking.report
 SELECT key::bigint,'ROOM_USAGE',((payload->>'createdAt')::timestamptz AT TIME ZONE 'Asia/Bangkok')::date,(payload->>'userId')::bigint,(payload->>'from')::date,(payload->>'to')::date,(payload->>'totalBookings')::integer,(payload->>'totalHours')::numeric,(payload->>'canceledCount')::integer,(payload->>'createdAt')::timestamptz FROM kku_private.reports ON CONFLICT(report_id) DO NOTHING;
 -- Preserve deleted catalog parents, never orphan historical children.
 UPDATE kku_booking.users SET is_deleted=true,deleted_at=coalesce(deleted_at,current_timestamp),account_status='INACTIVE' WHERE user_id NOT IN(SELECT key::bigint FROM kku_private.users);
 UPDATE kku_booking.room SET is_deleted=true,deleted_at=coalesce(deleted_at,current_timestamp) WHERE room_id NOT IN(SELECT key::bigint FROM kku_private.rooms);
 UPDATE kku_booking.building SET is_deleted=true,deleted_at=coalesce(deleted_at,current_timestamp) WHERE building_id NOT IN(SELECT key::bigint FROM kku_private.buildings);
 UPDATE kku_booking.equipment SET is_deleted=true,deleted_at=coalesce(deleted_at,current_timestamp),equipment_status='INACTIVE' WHERE equipment_type='LOAN' AND substring(equipment_id FROM 6) NOT IN(SELECT key FROM kku_private.equipment);
END $$;

-- One projection per transaction, after ALL source rows are saved. Deferred
-- triggers also protect writes made outside the NestJS adapter.
CREATE FUNCTION kku_private.project_business_transaction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF current_setting('kku.business_projected',true) IS DISTINCT FROM 'yes' THEN
  PERFORM set_config('kku.business_projected','yes',true);
  PERFORM kku_booking.sync_from_commands();
 END IF;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['users','buildings','rooms','equipment','bookings','notices','violations','penalties','audit','holidays','assignments','reports']) LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER project_business_transaction AFTER INSERT OR UPDATE OR DELETE ON kku_private.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kku_private.project_business_transaction()',t);
 END LOOP;
END $$;
-- Fail the migration atomically if historical rows violate the new model.
SELECT kku_booking.sync_from_commands();
SELECT setval('kku_booking.booking_log_seq',greatest(1,coalesce((SELECT max(booking_log_id) FROM kku_booking.booking_log),0)),true);
SELECT setval('kku_booking.notification_seq',greatest(1,coalesce((SELECT max(notification_id) FROM kku_booking.notification),0)),true);

REVOKE ALL ON SCHEMA kku_booking FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA kku_booking FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA kku_booking FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION kku_private.stamp_business_row(),kku_private.project_business_transaction(),kku_private.protect_saved_report() FROM PUBLIC,anon,authenticated;
ALTER TABLE kku_private.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kku_private.reports FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='kku_booking' LOOP
  EXECUTE format('ALTER TABLE kku_booking.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kku_server') THEN
  GRANT USAGE ON SCHEMA kku_booking TO kku_server;
  GRANT SELECT ON ALL TABLES IN SCHEMA kku_booking TO kku_server;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='kku_booking' LOOP
   EXECUTE format('CREATE POLICY server_read ON kku_booking.%I FOR SELECT TO kku_server USING(true)',t);
  END LOOP;
  GRANT SELECT,INSERT,UPDATE,DELETE ON kku_private.reports TO kku_server;
  CREATE POLICY server_access ON kku_private.reports TO kku_server USING(true) WITH CHECK(true);
  GRANT EXECUTE ON FUNCTION kku_private.stamp_business_row(),kku_private.project_business_transaction(),kku_private.protect_saved_report() TO kku_server;
 END IF;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA kku_booking REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kku_booking REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
COMMIT;
