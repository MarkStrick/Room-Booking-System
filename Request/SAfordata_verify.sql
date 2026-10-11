-- Oracle verification on a dedicated development schema AFTER the migration.
-- DML only; all fixtures roll back. Sequences/identity counters may advance.
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
ALTER SESSION SET TIME_ZONE='Asia/Bangkok';
DECLARE
 v_user NUMBER;v_building NUMBER;v_floor NUMBER;v_type NUMBER;v_room NUMBER;v_equipment NUMBER;v_booking NUMBER;v_other NUMBER;
 v_count NUMBER;v_remaining NUMBER;v_purpose VARCHAR2(500);v_slug VARCHAR2(32):=LOWER(RAWTOHEX(SYS_GUID()));
 v_start TIMESTAMP:=CAST(TRUNC(CAST(SYSTIMESTAMP AT TIME ZONE 'Asia/Bangkok' AS DATE))+1 AS TIMESTAMP)+INTERVAL '10' HOUR;
 v_attack VARCHAR2(500):=q'[O'Connor '); DELETE FROM users; --]';
BEGIN
 SELECT COUNT(*) INTO v_count FROM user_errors;
 IF v_count<>0 THEN RAISE_APPLICATION_ERROR(-20999,'Schema contains compilation errors'); END IF;
 INSERT INTO users(full_name,email,role_level,account_status) VALUES('SQL verification','sql-check-'||v_slug||'@example.invalid','STUDENT','ACTIVE') RETURNING user_id INTO v_user;
 INSERT INTO building(building_name) VALUES('SQL verification '||v_slug) RETURNING building_id INTO v_building;
 INSERT INTO floor(floor_number,building_building_id) VALUES('1',v_building) RETURNING floor_id INTO v_floor;
 INSERT INTO room_type(type_name) VALUES('SQL verification '||v_slug) RETURNING room_type_id INTO v_type;
 INSERT INTO room(room_name,capacity,room_status,floor_floor_id,room_type_room_type_id) VALUES('SQL verification '||v_slug,5,'AVAILABLE',v_floor,v_type) RETURNING room_id INTO v_room;
 INSERT INTO equipment(equipment_name,equipment_status,remaining_qty,total_qty) VALUES('SQL verification '||v_slug,'AVAILABLE',3,3) RETURNING equipment_id INTO v_equipment;
 INSERT INTO booking(booking_date,start_time,end_time,purpose,users_user_id,room_room_id,expected_attendees)
  VALUES(TRUNC(v_start),v_start,v_start+INTERVAL '1' HOUR,v_attack,v_user,v_room,2) RETURNING booking_id INTO v_booking;
 SELECT purpose INTO v_purpose FROM booking WHERE booking_id=v_booking;
 IF v_purpose<>v_attack THEN RAISE_APPLICATION_ERROR(-20999,'Literal text was not retained'); END IF;
 INSERT INTO booking_equipment(booking_booking_id,equipment_equipment_id,borrowed_qty) VALUES(v_booking,v_equipment,2);
 SELECT remaining_qty INTO v_remaining FROM equipment WHERE equipment_id=v_equipment;
 IF v_remaining<>1 THEN RAISE_APPLICATION_ERROR(-20999,'Reservation stock incorrect'); END IF;
 BEGIN
  INSERT INTO booking(booking_date,start_time,end_time,users_user_id,room_room_id,expected_attendees)
   VALUES(TRUNC(v_start),v_start+INTERVAL '30' MINUTE,v_start+INTERVAL '90' MINUTE,v_user,v_room,1);
  RAISE_APPLICATION_ERROR(-20999,'Overlap was accepted');
 EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20001 THEN RAISE; END IF; END;
 BEGIN
  UPDATE booking_equipment SET equipment_equipment_id=v_equipment+1 WHERE booking_booking_id=v_booking;
  RAISE_APPLICATION_ERROR(-20999,'Loan identity change was accepted');
 EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20006 THEN RAISE; END IF; END;
 INSERT INTO penalty(penalty_type,penalty_status,users_user_id,start_date,end_date,reason)
  VALUES('WARNING','ACTIVE',v_user,TRUNC(CAST(SYSTIMESTAMP AT TIME ZONE 'Asia/Bangkok' AS DATE)),TRUNC(v_start),'warning test');
 INSERT INTO booking(booking_date,start_time,end_time,users_user_id,room_room_id,expected_attendees)
  VALUES(TRUNC(v_start),v_start+INTERVAL '2' HOUR,v_start+INTERVAL '3' HOUR,v_user,v_room,1) RETURNING booking_id INTO v_other;
 UPDATE booking SET booking_status='CANCELLED' WHERE booking_id=v_booking;
 SELECT remaining_qty INTO v_remaining FROM equipment WHERE equipment_id=v_equipment;
 IF v_remaining<>3 THEN RAISE_APPLICATION_ERROR(-20999,'Unissued reservation was not released'); END IF;
 UPDATE booking SET cancel_reason='Repeated close' WHERE booking_id=v_booking;
 SELECT remaining_qty INTO v_remaining FROM equipment WHERE equipment_id=v_equipment;
 IF v_remaining<>3 THEN RAISE_APPLICATION_ERROR(-20999,'Stock released more than once'); END IF;
 BEGIN
  UPDATE booking SET booking_status='PENDING' WHERE booking_id=v_booking;
  RAISE_APPLICATION_ERROR(-20999,'Terminal booking was reopened');
 EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20007 THEN RAISE; END IF; END;
 SELECT COUNT(*) INTO v_count FROM stock_movement WHERE booking_id=v_booking;
 IF v_count<>2 THEN RAISE_APPLICATION_ERROR(-20999,'Expected one reserve and one release movement'); END IF;
 DBMS_OUTPUT.PUT_LINE('PASS: literal SQL text, overlap, loan identity, warning, release once and terminal state');
 ROLLBACK;
EXCEPTION WHEN OTHERS THEN ROLLBACK; RAISE;
END;
/
SELECT name,status,applied_at FROM kku_schema_migration;
SELECT name,type,line,text FROM user_errors ORDER BY name,sequence;
