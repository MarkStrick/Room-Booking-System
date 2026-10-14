BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog,extensions,public;
-- The command table checks conflicts immediately. Also enforce them on the
-- typed booking table, after a deferred projection has updated every status.
ALTER TABLE kku_booking.booking ADD CONSTRAINT booking_no_overlap
 EXCLUDE USING gist(room_room_id WITH =,tstzrange(start_time,end_time,'[)') WITH &&)
 WHERE(booking_status IN ('PENDING','APPROVED','CHECKED_IN'))
 DEFERRABLE INITIALLY DEFERRED;
COMMIT;
