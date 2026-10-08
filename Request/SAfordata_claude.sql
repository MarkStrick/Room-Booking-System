-- =====================================================================
-- SAfordata_fixes.sql
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
--   (CHECK ที่เพิ่มใช้ NOVALIDATE จึงไม่ตรวจแถวเดิม แต่แถวใหม่ต้องตรงตามค่าที่กำหนด)
-- Section 3:
--   SELECT LOWER(email), COUNT(*) FROM users WHERE is_deleted = 0
--    GROUP BY LOWER(email) HAVING COUNT(*) > 1;
-- Section 6:
--   SELECT holiday_date, COUNT(*) FROM holiday GROUP BY holiday_date HAVING COUNT(*) > 1;
-- =====================================================================


-- =====================================================================
-- 1. PK อัตโนมัติ  [ข้อ 3]
--    สร้าง <table>_seq เริ่มที่ MAX(pk)+1 แล้วตั้งเป็น DEFAULT ON NULL
--    ใช้ได้ทั้ง INSERT ที่ไม่ส่ง id และที่ส่ง NULL มา (รันซ้ำได้)
-- =====================================================================
DECLARE
  v_next NUMBER;
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
    EXECUTE IMMEDIATE 'SELECT NVL(MAX(' || r.c || '),0) + 1 FROM ' || r.t INTO v_next;
    BEGIN
      EXECUTE IMMEDIATE 'DROP SEQUENCE ' || r.t || '_SEQ';
    EXCEPTION WHEN OTHERS THEN
      IF SQLCODE != -2289 THEN RAISE; END IF;   -- -2289 = sequence ไม่มีอยู่
    END;
    EXECUTE IMMEDIATE 'CREATE SEQUENCE ' || r.t || '_SEQ START WITH ' || v_next ||
                      ' INCREMENT BY 1 CACHE 20';
    EXECUTE IMMEDIATE 'ALTER TABLE ' || r.t || ' MODIFY (' || r.c ||
                      ' DEFAULT ON NULL ' || r.t || '_SEQ.NEXTVAL)';
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
  CHECK (TRUNC(booking_date) = TRUNC(start_time)) ENABLE NOVALIDATE;

-- ---- CHECK ของคอลัมน์สถานะที่ยังเป็น VARCHAR อิสระ [ข้อ 6] ----
ALTER TABLE room ADD CONSTRAINT ck_room_status
  CHECK (room_status IN ('AVAILABLE','MAINTENANCE','CLOSED')) ENABLE NOVALIDATE;

ALTER TABLE equipment ADD CONSTRAINT ck_equipment_status
  CHECK (equipment_status IN ('AVAILABLE','IN_USE','MAINTENANCE','BROKEN')) ENABLE NOVALIDATE;

ALTER TABLE users ADD CONSTRAINT ck_users_account_status
  CHECK (account_status IN ('ACTIVE','SUSPENDED','INACTIVE')) ENABLE NOVALIDATE;

ALTER TABLE users ADD CONSTRAINT ck_users_role_level
  CHECK (role_level IN ('STUDENT','TEACHER','STAFF','ADMIN')) ENABLE NOVALIDATE;

ALTER TABLE penalty ADD CONSTRAINT ck_penalty_status
  CHECK (penalty_status IN ('ACTIVE','EXPIRED','REVOKED')) ENABLE NOVALIDATE;

ALTER TABLE booking_participant ADD CONSTRAINT ck_bpart_status
  CHECK (participation_status IN ('INVITED','ACCEPTED','DECLINED','ATTENDED')) ENABLE NOVALIDATE;

ALTER TABLE notification ADD CONSTRAINT ck_noti_type
  CHECK (noti_type IN ('BOOKING_CREATED','BOOKING_APPROVED','BOOKING_REJECTED',
                       'BOOKING_CANCELLED','REMINDER','PENALTY')) ENABLE NOVALIDATE;

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
  booking_booking_id  NOT NULL,
  users_user_id       NOT NULL
);

ALTER TABLE booking_log ADD (violation_flag_new NUMBER(1) DEFAULT 0 NOT NULL);
UPDATE booking_log SET violation_flag_new = CASE violation_flag WHEN 'YES' THEN 1 ELSE 0 END;
ALTER TABLE booking_log DROP CONSTRAINT booking_log_violation_ck;
ALTER TABLE booking_log DROP COLUMN violation_flag;
ALTER TABLE booking_log RENAME COLUMN violation_flag_new TO violation_flag;
ALTER TABLE booking_log ADD CONSTRAINT booking_log_violation_ck CHECK (violation_flag IN (0,1));

-- ---- report: report_type ห้าม NULL + CHECK, ชื่อคอลัมน์ให้ตรงกับตารางอื่น [ข้อ 7, 11] ----
ALTER TABLE report MODIFY (report_type NOT NULL);
ALTER TABLE report ADD CONSTRAINT ck_report_type
  CHECK (report_type IN ('DAILY','WEEKLY','MONTHLY','YEARLY')) ENABLE NOVALIDATE;
ALTER TABLE report RENAME COLUMN user_userid TO users_user_id;

-- ---- notification: params_json ต้องเป็น JSON ที่ valid [ข้อ 11] ----
ALTER TABLE notification ADD CONSTRAINT ck_noti_params_json
  CHECK (params_json IS JSON) ENABLE NOVALIDATE;

-- ---- equipment.created_by_user_id ยังไม่มี FK [ข้อ 11] ----
ALTER TABLE equipment ADD CONSTRAINT equipment_created_by_fk
  FOREIGN KEY (created_by_user_id) REFERENCES users (user_id);

-- ---- holiday: วันที่ต้องไม่ซ้ำ และไม่มีเวลาติดมา [ข้อ 10] ----
ALTER TABLE holiday ADD CONSTRAINT ck_holiday_date_trunc
  CHECK (holiday_date = TRUNC(holiday_date)) ENABLE NOVALIDATE;
ALTER TABLE holiday ADD CONSTRAINT holiday_date_un UNIQUE (holiday_date);


-- =====================================================================
-- 3. EMAIL UNIQUE เฉพาะผู้ใช้ที่ยังไม่ถูกลบ  [ข้อ 9]
--    ผู้ใช้ที่ soft delete แล้วสมัครใหม่ด้วยอีเมลเดิมได้
-- =====================================================================
ALTER TABLE users DROP CONSTRAINT users_email_un;
CREATE UNIQUE INDEX uq_users_email_active
  ON users (CASE WHEN is_deleted = 0 THEN LOWER(email) END);


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
--    และคืนเมื่อเป็น REJECTED / CANCELLED / COMPLETED / NO_SHOW
-- =====================================================================
ALTER TABLE equipment ADD (
  total_qty  NUMBER(5),
  usage_type VARCHAR2(20) DEFAULT 'BORROWABLE' NOT NULL
);

UPDATE equipment SET remaining_qty = 0 WHERE remaining_qty IS NULL;
UPDATE equipment SET total_qty = remaining_qty WHERE total_qty IS NULL;
-- หมายเหตุ: ข้างบนสมมติว่าของที่ยังไม่ถูกยืมคือจำนวนทั้งหมด ถ้ามีของถูกยืมค้างอยู่ให้ปรับ total_qty เอง

ALTER TABLE equipment MODIFY (total_qty NOT NULL, remaining_qty DEFAULT 0 NOT NULL);

ALTER TABLE equipment ADD CONSTRAINT ck_equipment_total     CHECK (total_qty >= 0);
ALTER TABLE equipment ADD CONSTRAINT ck_equipment_remaining CHECK (remaining_qty <= total_qty);
ALTER TABLE equipment ADD CONSTRAINT ck_equipment_usage
  CHECK (usage_type IN ('FIXED','BORROWABLE','BOTH'));

-- ตัด/คืนสต็อกเมื่อเพิ่ม แก้ หรือลบรายการอุปกรณ์ใน booking
CREATE OR REPLACE TRIGGER trg_be_stock
AFTER INSERT OR DELETE OR UPDATE OF borrowed_qty ON booking_equipment
FOR EACH ROW
DECLARE
  v_bid    booking.booking_id%TYPE;
  v_eid    equipment.equipment_id%TYPE;
  v_delta  NUMBER;
  v_status booking.booking_status%TYPE;
BEGIN
  IF INSERTING THEN
    v_bid := :NEW.booking_booking_id;  v_eid := :NEW.equipment_equipment_id;
    v_delta := -:NEW.borrowed_qty;
  ELSIF DELETING THEN
    v_bid := :OLD.booking_booking_id;  v_eid := :OLD.equipment_equipment_id;
    v_delta := :OLD.borrowed_qty;
  ELSE
    v_bid := :NEW.booking_booking_id;  v_eid := :NEW.equipment_equipment_id;
    v_delta := :OLD.borrowed_qty - :NEW.borrowed_qty;
  END IF;

  SELECT booking_status INTO v_status FROM booking WHERE booking_id = v_bid;

  -- booking ที่ปิดไปแล้ว สต็อกถูกคืนไปแล้ว ไม่ต้องปรับซ้ำ
  IF v_status IN ('PENDING','APPROVED','CHECKED_IN') AND v_delta <> 0 THEN
    UPDATE equipment SET remaining_qty = remaining_qty + v_delta
     WHERE equipment_id = v_eid;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -2290 THEN   -- equipment_qty_ck: remaining_qty < 0
      RAISE_APPLICATION_ERROR(-20005, 'สต็อกอุปกรณ์ไม่เพียงพอ (equipment_id=' || v_eid || ')');
    END IF;
    RAISE;
END;
/

-- คืนสต็อกอัตโนมัติเมื่อ booking ถูกปิด
CREATE OR REPLACE TRIGGER trg_booking_release_stock
AFTER UPDATE OF booking_status ON booking
FOR EACH ROW
WHEN (OLD.booking_status IN ('PENDING','APPROVED','CHECKED_IN')
  AND NEW.booking_status IN ('REJECTED','CANCELLED','COMPLETED','NO_SHOW'))
BEGIN
  FOR r IN (SELECT equipment_equipment_id eid, borrowed_qty qty
              FROM booking_equipment
             WHERE booking_booking_id = :NEW.booking_id) LOOP
    UPDATE equipment SET remaining_qty = remaining_qty + r.qty
     WHERE equipment_id = r.eid;
  END LOOP;
END;
/


-- =====================================================================
-- 6. กันจองซ้อนเวลา + business rule  [ข้อ 1, 10]
-- =====================================================================

-- 6.1 กันจองห้องเดียวกันซ้อนเวลา
--     BEFORE EACH ROW : ล็อกแถวห้อง (serialize การจองต่อห้อง) กัน race condition
--     AFTER STATEMENT : ค่อยตรวจ overlap (ตรวจใน row trigger ไม่ได้ เพราะติด ORA-04091)
--     สถานะที่ถือว่าครองช่วงเวลา: PENDING, APPROVED, CHECKED_IN
CREATE OR REPLACE TRIGGER trg_booking_no_overlap
FOR INSERT OR UPDATE OF room_room_id, start_time, end_time, booking_status ON booking
COMPOUND TRIGGER

  TYPE t_slot  IS RECORD (booking_id NUMBER(10), room_id NUMBER(10),
                          start_time TIMESTAMP, end_time TIMESTAMP);
  TYPE t_slots IS TABLE OF t_slot INDEX BY PLS_INTEGER;
  g_slots t_slots;

  BEFORE EACH ROW IS
    v_lock NUMBER;
  BEGIN
    IF :NEW.booking_status IN ('PENDING','APPROVED','CHECKED_IN') THEN
      SELECT room_id INTO v_lock
        FROM room
       WHERE room_id = :NEW.room_room_id
         FOR UPDATE;
    END IF;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN NULL;   -- ห้องไม่มีอยู่ ให้ FK แจ้ง error เอง
  END BEFORE EACH ROW;

  AFTER EACH ROW IS
    n PLS_INTEGER;
  BEGIN
    IF :NEW.booking_status IN ('PENDING','APPROVED','CHECKED_IN') THEN
      n := g_slots.COUNT + 1;
      g_slots(n).booking_id := :NEW.booking_id;
      g_slots(n).room_id    := :NEW.room_room_id;
      g_slots(n).start_time := :NEW.start_time;
      g_slots(n).end_time   := :NEW.end_time;
    END IF;
  END AFTER EACH ROW;

  AFTER STATEMENT IS
    v_cnt NUMBER;
  BEGIN
    FOR i IN 1 .. g_slots.COUNT LOOP
      SELECT COUNT(*) INTO v_cnt
        FROM booking b
       WHERE b.room_room_id = g_slots(i).room_id
         AND b.booking_id  <> g_slots(i).booking_id
         AND b.booking_status IN ('PENDING','APPROVED','CHECKED_IN')
         AND b.start_time < g_slots(i).end_time
         AND b.end_time   > g_slots(i).start_time;
      IF v_cnt > 0 THEN
        RAISE_APPLICATION_ERROR(-20001,
          'ห้องนี้ถูกจองแล้วในช่วงเวลาที่เลือก (room_id=' || g_slots(i).room_id || ')');
      END IF;
    END LOOP;
    g_slots.DELETE;
  END AFTER STATEMENT;

END trg_booking_no_overlap;
/

-- 6.2 กฎวันหยุด / penalty / เจ้าหน้าที่ประจำห้อง
--     วันหยุดและ penalty ตรวจตอนสร้างหรือเปลี่ยนวัน/ผู้จอง เท่านั้น
--     (กันไม่ให้ penalty ที่เพิ่งออกมาขวางการอนุมัติ booking เดิม)
CREATE OR REPLACE TRIGGER trg_booking_rules
BEFORE INSERT OR UPDATE OF booking_date, users_user_id, room_room_id,
                           booking_status, staff_staff_id ON booking
FOR EACH ROW
DECLARE
  v_cnt NUMBER;
BEGIN
  IF :NEW.booking_status IN ('PENDING','APPROVED','CHECKED_IN')
     AND (INSERTING
          OR :NEW.booking_date  <> :OLD.booking_date
          OR :NEW.users_user_id <> :OLD.users_user_id) THEN

    SELECT COUNT(*) INTO v_cnt
      FROM holiday
     WHERE holiday_date = TRUNC(:NEW.booking_date);
    IF v_cnt > 0 THEN
      RAISE_APPLICATION_ERROR(-20002, 'ไม่สามารถจองในวันหยุดได้');
    END IF;

    SELECT COUNT(*) INTO v_cnt
      FROM penalty
     WHERE users_user_id = :NEW.users_user_id
       AND penalty_status = 'ACTIVE'
       AND (start_date IS NULL OR start_date <= TRUNC(:NEW.booking_date))
       AND (end_date   IS NULL OR end_date   >= TRUNC(:NEW.booking_date));
    IF v_cnt > 0 THEN
      RAISE_APPLICATION_ERROR(-20003, 'ผู้ใช้ติด penalty ที่ยังมีผลบังคับ ไม่สามารถจองได้');
    END IF;
  END IF;

  IF :NEW.staff_staff_id IS NOT NULL
     AND :NEW.booking_status IN ('APPROVED','REJECTED') THEN
    SELECT COUNT(*) INTO v_cnt
      FROM room_assignment
     WHERE staff_staff_id = :NEW.staff_staff_id
       AND room_room_id   = :NEW.room_room_id;
    IF v_cnt = 0 THEN
      RAISE_APPLICATION_ERROR(-20004, 'เจ้าหน้าที่ไม่ได้รับมอบหมายให้ดูแลห้องนี้');
    END IF;
  END IF;
END;
/


-- =====================================================================
-- 7. ตรวจผลลัพธ์ (ควรไม่มีแถวคืนมาทั้งสองคำสั่ง)
-- =====================================================================
SELECT object_name, object_type, status FROM user_objects WHERE status <> 'VALID';
SELECT name, type, line, text FROM user_errors ORDER BY name, sequence;
