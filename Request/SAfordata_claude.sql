-- =====================================================================
-- SAfordata_claude.sql -- revised 12 October 2026
-- สคริปต์ ALTER แก้จุดเสี่ยงของ SAfordata.ddl (ระบบจองห้อง / ยืมอุปกรณ์)
-- เป้าหมาย: Oracle 12.1.0.2 ขึ้นไป (ต้องใช้ IS JSON และ DEFAULT ON NULL)
-- รันด้วย SQL Developer "Run Script" (F5) หรือ SQL*Plus ด้วย schema เจ้าของตาราง
--
-- สารบัญ
--   0. Pre-check (ตรวจข้อมูลเดิมก่อนรัน)
--   1. PK อัตโนมัติ (sequence + DEFAULT ON NULL)          [ข้อ 3]
--   2. Constraint / nullability / CHECK                    [ข้อ 6, 7, 8, 11]
--   3. Email unique เฉพาะผู้ใช้ที่ยังไม่ถูกลบ              [ข้อ 9]
--   4. Index ให้ FK + ตัด index ซ้ำ                        [ข้อ 4, 5]
--   5. สต็อกอุปกรณ์ (total_qty + atomic update)            [ข้อ 2]
--   6. กันจองซ้อนเวลา + business rule                      [ข้อ 1, 10]
--   7. ตรวจผลลัพธ์
--
-- รหัส error ที่ trigger จะ raise (ให้ app จับไปแสดงผล)
--   ORA-20001  ห้องถูกจองซ้อนช่วงเวลา
--   ORA-20002  วันที่จองตรงกับวันหยุด
--   ORA-20003  ผู้ใช้ติด penalty ที่ยังมีผล
--   ORA-20004  เจ้าหน้าที่ไม่ได้รับมอบหมายห้องนี้ (room_assignment)
--   ORA-20005  สต็อกอุปกรณ์ไม่พอ
--
-- ค่าที่ "สมมติ" ใน CHECK (แก้ให้ตรงกับที่ app ใช้จริงก่อนรัน Section 2)
--   room_status           AVAILABLE, MAINTENANCE, CLOSED
--   equipment_status      AVAILABLE, IN_USE, MAINTENANCE, BROKEN
--   account_status        ACTIVE, SUSPENDED, INACTIVE
--   role_level            STUDENT, TEACHER, STAFF, ADMIN
--   penalty_status        ACTIVE, EXPIRED, REVOKED
--   participation_status  INVITED, ACCEPTED, DECLINED, ATTENDED
--   report_type           DAILY, WEEKLY, MONTHLY, YEARLY
--   noti_type             BOOKING_CREATED, BOOKING_APPROVED, BOOKING_REJECTED,
--                         BOOKING_CANCELLED, REMINDER, PENALTY
--
-- การเปลี่ยนที่กระทบ application
--   * report.user_userid  -> users_user_id   (rename column)
--   * booking_log.violation_flag 'YES'/'NO'  -> NUMBER(1) 1/0
--   * booking.booking_status เป็น NOT NULL DEFAULT 'PENDING' และเพิ่มสถานะ NO_SHOW
--   * users.email unique แบบไม่สนตัวพิมพ์เล็กใหญ่ (เฉพาะ is_deleted = 0)
--   * ถ้า app เคย UPDATE equipment.remaining_qty เอง ให้เอาโค้ดนั้นออก (Section 5)
-- =====================================================================

SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

-- One-time migration from SAfordata.ddl, in a maintenance window.
-- Oracle DDL commits implicitly. Back up first; do not rerun after a partial DDL.
-- Legacy loans have no issued/returned evidence: refuse to invent physical stock.
DECLARE v_count NUMBER;
BEGIN
 SELECT COUNT(*) INTO v_count FROM booking_equipment;
 IF v_count>0 THEN
  RAISE_APPLICATION_ERROR(-20090,'Reconcile and migrate legacy loans with physical issued/returned quantities before this migration');
 END IF;
 SELECT COUNT(*) INTO v_count FROM room WHERE capacity IS NULL OR capacity<=0 OR floor_floor_id IS NULL OR room_type_room_type_id IS NULL;
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Repair missing room capacity/floor/type before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM equipment WHERE remaining_qty IS NULL OR remaining_qty<0;
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Reconcile equipment quantities before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM users WHERE account_status IS NULL OR role_level IS NULL OR account_status NOT IN('ACTIVE','SUSPENDED','INACTIVE') OR role_level NOT IN('STUDENT','TEACHER','STAFF','ADMIN');
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Normalize legacy user status/role before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM room WHERE room_status IS NULL OR is_deleted IS NULL OR room_status NOT IN('AVAILABLE','MAINTENANCE','CLOSED');
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Normalize room status before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM equipment WHERE equipment_status IS NULL OR is_deleted IS NULL OR equipment_status NOT IN('AVAILABLE','IN_USE','MAINTENANCE','BROKEN');
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Normalize equipment status before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM booking WHERE end_time-start_time NOT BETWEEN INTERVAL '30' MINUTE AND INTERVAL '4' HOUR OR TRUNC(booking_date)<>TRUNC(start_time);
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Repair legacy booking duration/date before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM booking_log WHERE action_type IS NULL OR action_time IS NULL OR booking_booking_id IS NULL OR violation_flag NOT IN('YES','NO');
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Repair legacy audit records before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM report WHERE report_type IS NULL OR report_type NOT IN('DAILY','WEEKLY','MONTHLY','YEARLY');
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Normalize report types before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM staff WHERE users_user_id IS NULL OR staff_status IS NULL OR staff_status NOT IN('ACTIVE','INACTIVE');
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Normalize staff accounts before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM penalty WHERE penalty_type IS NULL OR penalty_type NOT IN('WARNING','SUSPENSION') OR penalty_status IS NULL OR penalty_status NOT IN('ACTIVE','EXPIRED','REVOKED');
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Normalize penalty types/status before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM notification WHERE noti_type IS NULL OR noti_type NOT IN('BOOKING_CREATED','BOOKING_APPROVED','BOOKING_REJECTED','BOOKING_CANCELLED','REMINDER','PENALTY');
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Map notification event types; EMAIL is a channel before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM booking_participant WHERE participation_status IS NULL OR participation_status NOT IN('INVITED','ACCEPTED','DECLINED','ATTENDED');
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Normalize participant statuses before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM room_equipment WHERE quantity IS NULL OR quantity<=0;
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Repair room inventory before migration'); END IF;
 SELECT COUNT(*) INTO v_count FROM(SELECT LOWER(TRIM(email)) FROM users WHERE is_deleted=0 GROUP BY LOWER(TRIM(email)) HAVING COUNT(*)>1);
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Duplicate active email addresses'); END IF;
 SELECT COUNT(*) INTO v_count FROM users WHERE TRIM(email) IS NULL OR email<>TRIM(email);
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Normalize legacy email whitespace'); END IF;
 SELECT COUNT(*) INTO v_count FROM(SELECT holiday_date FROM holiday GROUP BY holiday_date HAVING COUNT(*)>1);
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Duplicate holidays'); END IF;
 SELECT COUNT(*) INTO v_count FROM holiday WHERE holiday_date<>TRUNC(holiday_date);
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Normalize holiday dates'); END IF;
 SELECT COUNT(*) INTO v_count FROM(SELECT floor_floor_id,LOWER(TRIM(room_name)) FROM room GROUP BY floor_floor_id,LOWER(TRIM(room_name)) HAVING COUNT(*)>1);
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Duplicate room names within a floor'); END IF;
 SELECT COUNT(*) INTO v_count FROM(SELECT building_building_id,LOWER(TRIM(floor_number)) FROM floor GROUP BY building_building_id,LOWER(TRIM(floor_number)) HAVING COUNT(*)>1);
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Duplicate floor numbers within a building'); END IF;
 SELECT COUNT(*) INTO v_count FROM booking a JOIN booking b ON a.booking_id<b.booking_id AND a.room_room_id=b.room_room_id
  WHERE NVL(a.booking_status,'PENDING') IN('PENDING','APPROVED','CHECKED_IN') AND NVL(b.booking_status,'PENDING') IN('PENDING','APPROVED','CHECKED_IN') AND a.start_time<b.end_time AND a.end_time>b.start_time;
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20090,'Repair legacy overlapping bookings'); END IF;
END;
/

-- Record STARTED before the first ALTER; a failed Oracle DDL requires forward repair.
DECLARE v_count NUMBER;
BEGIN
 SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='KKU_SCHEMA_MIGRATION';
 IF v_count=0 THEN EXECUTE IMMEDIATE 'CREATE TABLE kku_schema_migration(name VARCHAR2(100) PRIMARY KEY,status VARCHAR2(10) NOT NULL,applied_at TIMESTAMP)'; END IF;
END;
/
DECLARE v_count NUMBER;
BEGIN
 SELECT COUNT(*) INTO v_count FROM kku_schema_migration WHERE name='business_security_20261012';
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20092,'Migration already applied or started; do not rerun DDL'); END IF;
 INSERT INTO kku_schema_migration(name,status) VALUES('business_security_20261012','STARTED');
END;
/

-- =====================================================================
-- 0. PRE-CHECK  (รันทีละคำสั่งก่อน ถ้ามีแถวคืนมา ต้องแก้ข้อมูลก่อนรัน Section ที่ระบุ)
-- =====================================================================
-- Section 2:
--   SELECT * FROM booking_equipment WHERE borrowed_qty IS NULL;
--   SELECT * FROM booking_log WHERE action_type IS NULL OR action_time IS NULL
--                                OR booking_booking_id IS NULL OR users_user_id IS NULL;
--   SELECT * FROM report WHERE report_type IS NULL;
--   SELECT DISTINCT room_status FROM room;
--   SELECT DISTINCT equipment_status FROM equipment;
--   SELECT DISTINCT account_status, role_level FROM users;
--   SELECT DISTINCT penalty_status FROM penalty;
--   SELECT DISTINCT participation_status FROM booking_participant;
--   SELECT DISTINCT noti_type FROM notification;
--   CHECK ใหม่ใช้ ENABLE VALIDATE เพื่อบังคับตรวจข้อมูลเดิมด้วย
-- Section 3:
--   SELECT LOWER(email), COUNT(*) FROM users WHERE is_deleted = 0
--    GROUP BY LOWER(email) HAVING COUNT(*) > 1;
-- Section 6:
--   SELECT holiday_date, COUNT(*) FROM holiday GROUP BY holiday_date HAVING COUNT(*) > 1;
-- =====================================================================


-- =====================================================================
-- 1. PK อัตโนมัติ  [ข้อ 3]
--    สร้าง <table>_seq เริ่มที่ MAX(pk)+1 แล้วตั้งเป็น DEFAULT ON NULL
--    ใช้ได้ทั้ง INSERT ที่ไม่ส่ง id และที่ส่ง NULL มา; ไม่ DROP sequence เดิม
-- =====================================================================
DECLARE
  v_next NUMBER;
  v_current NUMBER;
  v_exists NUMBER;
  v_table VARCHAR2(128);
  v_column VARCHAR2(128);
  v_seq VARCHAR2(128);
  v_delta VARCHAR2(40);
BEGIN
  FOR r IN (
    SELECT 'AFFILIATION' t, 'AFFILIATION_ID' c FROM dual UNION ALL
    SELECT 'BOOKING',       'BOOKING_ID'       FROM dual UNION ALL
    SELECT 'BOOKING_LOG',   'BOOKING_LOG_ID'   FROM dual UNION ALL
    SELECT 'BUILDING',      'BUILDING_ID'      FROM dual UNION ALL
    SELECT 'EQUIPMENT',     'EQUIPMENT_ID'     FROM dual UNION ALL
    SELECT 'FLOOR',         'FLOOR_ID'         FROM dual UNION ALL
    SELECT 'HOLIDAY',       'HOLIDAY_ID'       FROM dual UNION ALL
    SELECT 'NOTIFICATION',  'NOTIFICATION_ID'  FROM dual UNION ALL
    SELECT 'PENALTY',       'PENALTY_ID'       FROM dual UNION ALL
    SELECT 'REPORT',        'REPORT_ID'        FROM dual UNION ALL
    SELECT 'ROOM',          'ROOM_ID'          FROM dual UNION ALL
    SELECT 'ROOM_TYPE',     'ROOM_TYPE_ID'     FROM dual UNION ALL
    SELECT 'STAFF',         'STAFF_ID'         FROM dual UNION ALL
    SELECT 'USERS',         'USER_ID'          FROM dual
  ) LOOP
    -- All identifiers originate from the literal allowlist above, then are asserted.
    v_table := DBMS_ASSERT.SIMPLE_SQL_NAME(r.t);
    v_column := DBMS_ASSERT.SIMPLE_SQL_NAME(r.c);
    v_seq := DBMS_ASSERT.SIMPLE_SQL_NAME(r.t || '_SEQ');
    EXECUTE IMMEDIATE 'SELECT NVL(MAX(' || v_column || '),0) + 1 FROM ' || v_table INTO v_next;
    SELECT COUNT(*) INTO v_exists FROM user_sequences WHERE sequence_name=v_seq;
    IF v_exists=0 THEN
      EXECUTE IMMEDIATE 'CREATE SEQUENCE ' || v_seq || ' START WITH ' || TO_CHAR(v_next,'FM99999999999999999990') || ' INCREMENT BY 1 CACHE 20';
    ELSE
      EXECUTE IMMEDIATE 'SELECT ' || v_seq || '.NEXTVAL FROM dual' INTO v_current;
      IF v_current<v_next THEN
        v_delta:=TO_CHAR(v_next-v_current,'FM99999999999999999990');
        EXECUTE IMMEDIATE 'ALTER SEQUENCE ' || v_seq || ' INCREMENT BY ' || v_delta;
        EXECUTE IMMEDIATE 'SELECT ' || v_seq || '.NEXTVAL FROM dual' INTO v_current;
        EXECUTE IMMEDIATE 'ALTER SEQUENCE ' || v_seq || ' INCREMENT BY 1';
      END IF;
    END IF;
    EXECUTE IMMEDIATE 'ALTER TABLE ' || v_table || ' MODIFY (' || v_column || ' DEFAULT ON NULL ' || v_seq || '.NEXTVAL)';
    DBMS_OUTPUT.PUT_LINE(r.t || '_SEQ start with ' || v_next);
  END LOOP;
END;
/


-- =====================================================================
-- 2. CONSTRAINT / NULLABILITY / CHECK  [ข้อ 6, 7, 8, 11]
-- =====================================================================

-- ---- booking: สถานะ + default ----
UPDATE booking SET booking_status = 'PENDING' WHERE booking_status IS NULL;
ALTER TABLE booking MODIFY (booking_status DEFAULT 'PENDING' NOT NULL);

ALTER TABLE booking DROP CONSTRAINT ck_booking_status;
ALTER TABLE booking ADD CONSTRAINT ck_booking_status
  CHECK (booking_status IN ('PENDING','APPROVED','REJECTED','CANCELLED',
                            'CHECKED_IN','COMPLETED','NO_SHOW'));

-- ---- booking: booking_date ต้องตรงกับวันของ start_time [ข้อ 8] ----
ALTER TABLE booking ADD CONSTRAINT ck_booking_date_match
  CHECK (TRUNC(booking_date) = TRUNC(start_time)) ENABLE VALIDATE;

-- ---- CHECK ของคอลัมน์สถานะที่ยังเป็น VARCHAR อิสระ [ข้อ 6] ----
ALTER TABLE room ADD CONSTRAINT ck_room_status
  CHECK (room_status IN ('AVAILABLE','MAINTENANCE','CLOSED')) ENABLE VALIDATE;

ALTER TABLE equipment ADD CONSTRAINT ck_equipment_status
  CHECK (equipment_status IN ('AVAILABLE','IN_USE','MAINTENANCE','BROKEN')) ENABLE VALIDATE;

ALTER TABLE users ADD CONSTRAINT ck_users_account_status
  CHECK (account_status IN ('ACTIVE','SUSPENDED','INACTIVE')) ENABLE VALIDATE;

ALTER TABLE users ADD CONSTRAINT ck_users_role_level
  CHECK (role_level IN ('STUDENT','TEACHER','STAFF','ADMIN')) ENABLE VALIDATE;

ALTER TABLE penalty ADD CONSTRAINT ck_penalty_status
  CHECK (penalty_status IN ('ACTIVE','EXPIRED','REVOKED')) ENABLE VALIDATE;

ALTER TABLE booking_participant ADD CONSTRAINT ck_bpart_status
  CHECK (participation_status IN ('INVITED','ACCEPTED','DECLINED','ATTENDED')) ENABLE VALIDATE;

ALTER TABLE notification ADD CONSTRAINT ck_noti_type
  CHECK (noti_type IN ('BOOKING_CREATED','BOOKING_APPROVED','BOOKING_REJECTED',
                       'BOOKING_CANCELLED','REMINDER','PENALTY')) ENABLE VALIDATE;

-- ---- ค่า boolean แบบ NUMBER(1) ต้องเป็น 0/1 เท่านั้น [ข้อ 11] ----
ALTER TABLE users     ADD CONSTRAINT ck_users_is_deleted     CHECK (is_deleted IN (0,1));
ALTER TABLE room      ADD CONSTRAINT ck_room_is_deleted      CHECK (is_deleted IN (0,1));
ALTER TABLE equipment ADD CONSTRAINT ck_equipment_is_deleted CHECK (is_deleted IN (0,1));

-- ---- booking_equipment: borrowed_qty ห้าม NULL [ข้อ 7] ----
ALTER TABLE booking_equipment MODIFY (borrowed_qty NOT NULL);

-- ---- booking_log: ห้าม NULL + เปลี่ยน violation_flag เป็น NUMBER(1) [ข้อ 7, 11] ----
ALTER TABLE booking_log MODIFY (
  action_type         NOT NULL,
  action_time         DEFAULT SYSTIMESTAMP NOT NULL,
  booking_booking_id  NOT NULL
);
ALTER TABLE booking_log ADD (actor_type VARCHAR2(10) DEFAULT 'USER' NOT NULL, affected_user_id NUMBER(10));
UPDATE booking_log SET actor_type='UNKNOWN' WHERE users_user_id IS NULL;
UPDATE booking_log l SET affected_user_id=(SELECT b.users_user_id FROM booking b WHERE b.booking_id=l.booking_booking_id);
ALTER TABLE booking_log ADD CONSTRAINT blog_actor_ck CHECK ((actor_type IN('SYSTEM','UNKNOWN') AND users_user_id IS NULL) OR (actor_type='USER' AND users_user_id IS NOT NULL));
ALTER TABLE booking_log ADD CONSTRAINT blog_affected_fk FOREIGN KEY(affected_user_id) REFERENCES users(user_id);

ALTER TABLE booking_log ADD (violation_flag_new NUMBER(1) DEFAULT 0 NOT NULL);
UPDATE booking_log SET violation_flag_new = CASE violation_flag WHEN 'YES' THEN 1 ELSE 0 END;
ALTER TABLE booking_log DROP CONSTRAINT booking_log_violation_ck;
ALTER TABLE booking_log DROP COLUMN violation_flag;
ALTER TABLE booking_log RENAME COLUMN violation_flag_new TO violation_flag;
ALTER TABLE booking_log ADD CONSTRAINT booking_log_violation_ck CHECK (violation_flag IN (0,1));

-- ---- report: report_type ห้าม NULL + CHECK, ชื่อคอลัมน์ให้ตรงกับตารางอื่น [ข้อ 7, 11] ----
ALTER TABLE report MODIFY (report_type NOT NULL);
ALTER TABLE report ADD CONSTRAINT ck_report_type
  CHECK (report_type IN ('DAILY','WEEKLY','MONTHLY','YEARLY')) ENABLE VALIDATE;
ALTER TABLE report RENAME COLUMN user_userid TO users_user_id;

-- ---- notification: params_json ต้องเป็น JSON ที่ valid [ข้อ 11] ----
ALTER TABLE notification ADD CONSTRAINT ck_noti_params_json
  CHECK (params_json IS JSON) ENABLE VALIDATE;

-- ---- equipment.created_by_user_id ยังไม่มี FK [ข้อ 11] ----
ALTER TABLE equipment ADD CONSTRAINT equipment_created_by_fk
  FOREIGN KEY (created_by_user_id) REFERENCES users (user_id);

-- ---- holiday: วันที่ต้องไม่ซ้ำ และไม่มีเวลาติดมา [ข้อ 10] ----
ALTER TABLE holiday ADD CONSTRAINT ck_holiday_date_trunc
  CHECK (holiday_date = TRUNC(holiday_date)) ENABLE VALIDATE;
ALTER TABLE holiday ADD CONSTRAINT holiday_date_un UNIQUE (holiday_date);


-- =====================================================================
-- 3. EMAIL UNIQUE เฉพาะผู้ใช้ที่ยังไม่ถูกลบ  [ข้อ 9]
--    ผู้ใช้ที่ soft delete แล้วสมัครใหม่ด้วยอีเมลเดิมได้
-- =====================================================================
ALTER TABLE users DROP CONSTRAINT users_email_un;
CREATE UNIQUE INDEX uq_users_email_active
  ON users (CASE WHEN is_deleted = 0 THEN LOWER(TRIM(email)) END);
ALTER TABLE users ADD CONSTRAINT users_email_trim_ck CHECK(TRIM(email) IS NOT NULL AND email=TRIM(email));


-- =====================================================================
-- 4. INDEX ให้ FOREIGN KEY + ตัด index ซ้ำ  [ข้อ 4, 5]
--    (FK ที่เป็นคอลัมน์นำหน้าของ PK/UNIQUE/index เดิมอยู่แล้ว ไม่ต้องเพิ่ม)
-- =====================================================================
DROP INDEX idx_booking_user;   -- ถูกครอบโดย idx_booking_user_history

CREATE INDEX idx_be_equipment      ON booking_equipment  (equipment_equipment_id);
CREATE INDEX idx_blog_booking      ON booking_log        (booking_booking_id);
CREATE INDEX idx_blog_user         ON booking_log        (users_user_id);
CREATE INDEX idx_bpart_user        ON booking_participant(users_user_id);
CREATE INDEX idx_booking_staff     ON booking            (staff_staff_id);
CREATE INDEX idx_equipment_creator ON equipment          (created_by_user_id);
CREATE INDEX idx_floor_building    ON floor              (building_building_id);
CREATE INDEX idx_noti_booking      ON notification       (booking_booking_id);
CREATE INDEX idx_noti_user         ON notification       (users_user_id);
CREATE INDEX idx_penalty_user      ON penalty            (users_user_id);
CREATE INDEX idx_penalty_staff     ON penalty            (staff_staff_id);
CREATE INDEX idx_penalty_booking   ON penalty            (booking_booking_id);
CREATE INDEX idx_report_user       ON report             (users_user_id);
CREATE INDEX idx_rassign_room      ON room_assignment    (room_room_id);
CREATE INDEX idx_requip_equipment  ON room_equipment     (equipment_equipment_id);
CREATE INDEX idx_room_floor        ON room               (floor_floor_id);
CREATE INDEX idx_room_type         ON room               (room_type_room_type_id);
CREATE INDEX idx_users_affiliation ON users              (affiliation_affiliation_id);


-- =====================================================================
-- 5. สต็อกอุปกรณ์  [ข้อ 2]
--    - เพิ่ม total_qty และ usage_type (แยกอุปกรณ์ประจำห้อง / ยืมได้)
--    - remaining_qty ห้าม NULL (เดิม NULL ผ่าน CHECK >= 0 ได้ ทำให้ตัวเลขเพี้ยนเงียบ ๆ)
--    - ตัด/คืนสต็อกด้วย UPDATE ครั้งเดียวใน trigger: row lock ทำให้ไม่ชนกัน
--      และ equipment_qty_ck กันไม่ให้ติดลบ
--    สต็อกถูกถือไว้เมื่อ booking เป็น PENDING / APPROVED / CHECKED_IN
--    ปิดรอบคืนเฉพาะจำนวนที่ยังไม่จ่าย; ของจ่ายแล้วคืนเมื่อบันทึกรับคืนจริง
-- =====================================================================
ALTER TABLE equipment ADD (
  total_qty  NUMBER(5),
  usage_type VARCHAR2(20) DEFAULT 'BORROWABLE' NOT NULL
);

UPDATE equipment SET remaining_qty = 0 WHERE remaining_qty IS NULL;
UPDATE equipment SET total_qty = remaining_qty WHERE total_qty IS NULL;
-- Preflight requires no legacy loans and reconciled physical quantities. No loan data is guessed.

ALTER TABLE equipment MODIFY (total_qty NOT NULL, remaining_qty DEFAULT 0 NOT NULL);

ALTER TABLE equipment ADD CONSTRAINT ck_equipment_total     CHECK (total_qty >= 0);
ALTER TABLE equipment ADD CONSTRAINT ck_equipment_remaining CHECK (remaining_qty <= total_qty);
ALTER TABLE equipment ADD CONSTRAINT ck_equipment_usage
  CHECK (usage_type IN ('FIXED','BORROWABLE','BOTH'));

-- Updated business rules, stock movements, outbox and access role.
@@SAfordata_business_security.sql

UPDATE kku_schema_migration SET status='APPLIED',applied_at=SYSTIMESTAMP WHERE name='business_security_20261012';
COMMIT;

SELECT object_name, object_type, status FROM user_objects WHERE status <> 'VALID';
SELECT name, type, line, text FROM user_errors ORDER BY name, sequence;
SELECT table_name, constraint_name, status, validated FROM user_constraints
 WHERE status <> 'ENABLED' OR validated <> 'VALIDATED';
