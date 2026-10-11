# SQL และการป้องกัน SQL injection — 12 ตุลาคม 2569

ปรับทั้ง PostgreSQL/Supabase ที่แอปใช้อยู่ และสคริปต์ Oracle เดิมตามคำขอ โดย Supabase ติดตั้ง migration แล้ว ส่วน Oracle เป็นไฟล์สำหรับนำไปตรวจบน Oracle development database ยังไม่ได้รันหรือรับรองการ compile/concurrency บน Oracle จริง

## PostgreSQL/Supabase

เพิ่ม [migration](../supabase/migrations/20261011184944_sql_security_hardening.sql) โดยไม่แก้ migration เดิมที่ติดตั้งแล้ว:

- JSONB ต้องเป็น object และมี ID ตรงกับ key; users ต้องมีอีเมล บทบาท และ active; rooms ต้องมี capacity/floor/status และ FK ไป building
- quantity อุปกรณ์ต้องเป็นจำนวนเต็มและ `0 <= remaining <= total`; booking ต้องมี attendees และเวลาใน payload ตรงกับคอลัมน์จริง
- credentials/token ไม่ผ่าน CHECK ด้วย NULL หรือการขาดฟิลด์ได้อีก; register token ต้องมี Argon2id hash
- trigger ห้ามเปิด terminal booking กลับเป็น active และห้ามเปลี่ยนเจ้าของ ห้อง หรือช่วงเวลา; metadata/การคืนอุปกรณ์หลังจบรอบยังแก้ได้
- โค้ดใช้ `$1...` สำหรับค่าทุกครั้ง ชื่อตารางผ่านรายการตายตัวที่ freeze และ quote; SQLite ใช้ prepared statements `?` ตามเดิม
- transaction ใช้ `search_path=pg_catalog`, statement timeout 30 วินาที และ lock timeout 10 วินาที; ไม่มีข้อมูล request เข้าสู่ query text
- `kku_server` มี DML ผ่าน RLS policy เฉพาะ role นี้ ไม่เป็นเจ้าของตาราง ไม่มี CREATE/TRUNCATE/BYPASSRLS; NestJS รับผิดชอบตรวจ session, CSRF, บทบาท และขอบเขตแถวก่อนเขียน
- ข้อผิดพลาด constraint ส่งข้อความทั่วไป ไม่เผยแพร่ SQL/table/driver detail ให้ผู้ใช้

ผล cloud: RLS 23 ตาราง, server policies 23, runtime เป็นเจ้าของ 0 ตาราง, constraints ไม่ validated 0 รายการ, browser roles เข้า private schema ไม่ได้ และ Security Advisor ไม่มี lints หลังแก้ ตรวจการเชื่อมจากเครื่องผ่าน TLS และ runtime permissions แล้ว

สำหรับฐานใหม่ ให้ provision `kku_server` เป็น LOGIN ที่ไม่มีสิทธิ์พิเศษผ่านช่องทางผู้ดูแลก่อนรัน hardening migration เพื่อสร้าง grants/policies ให้ครบ รัน migration ด้วยบัญชีผู้ดูแลและเทียบ remote history ก่อน `db push`; cloud เดิมมี timestamps ต่างจากไฟล์ local และติดตั้ง hardening ผ่าน MCP ชื่อ `sql_security_hardening` แล้ว ห้ามรันซ้ำหรือรัน settings migration เดิมซ้ำ เพราะจะโอน ownership กลับไป runtime

## Oracle เดิม

รัน [SAfordata_claude.sql](../../Request/SAfordata_claude.sql) จาก SQL Developer F5/SQL*Plus โดยวาง [business security](../../Request/SAfordata_business_security.sql) ไว้โฟลเดอร์เดียวกัน; `@@` โหลดส่วนเสริมตามพาธสคริปต์ ใช้ baseline `SAfordata.ddl` และรันเพียงครั้งเดียวใน maintenance window หลังสำรองข้อมูล Oracle DDL commit โดยปริยาย; ledger `STARTED/APPLIED` ป้องกันการรันซ้ำหลังล้มเหลว

สคริปต์ตรวจข้อมูลเดิมก่อน ALTER และหยุดถ้ามี loan เดิม เพราะ baseline ไม่มีหลักฐานจ่าย/คืน ต้อง reconcile และจัด migration สำหรับข้อมูลจริงก่อน ไม่ลบ loan หรือสมมติว่าของคืนแล้วเพื่อให้สคริปต์ผ่าน สำหรับอุปกรณ์ที่ไม่มี loan ให้ผู้ดูแลยืนยันว่า remaining_qty ตรงกับจำนวนกองยืมจริงก่อนตั้ง total_qty ข้อมูล expected attendees เดิมใช้จำนวนผู้จองและผู้ร่วมใช้ที่มีหลักฐานเป็นค่า backfill ขั้นต่ำ ต้องยืนยันจำนวนคาดหมายจริงก่อนเปิดให้ใช้งาน

การแก้สำคัญ:

- ไม่ DROP/recreate sequence; identifier มาจาก literal allowlist และ `DBMS_ASSERT`, ตัวเลข DDL ใช้รูปแบบตัวเลขตายตัว
- CHECK ใช้ VALIDATE พร้อม NOT NULL/unique/FK ที่จำเป็น; email unique แบบไม่สนตัวพิมพ์และ whitespace
- statement gate ให้ทุก booking/stock/policy write ใช้ลำดับล็อกเดียวกัน; compound trigger ตรวจ overlap และ PENDING ไม่เกิน 3 ต่อผู้ใช้หลัง statement
- WARNING ไม่บล็อกจอง; SUSPENSION ตรวจตอนสร้างและเช็คอิน; STAFF ต้องมี assignment ที่ยังมีผล ส่วน ADMIN พิจารณาได้ทุกห้องและเก็บ actor
- loan identity/จำนวนกันจองแก้ไม่ได้; issued/returned/released เพิ่มได้ทางเดียว พร้อม stock movement และ source key ที่ unique
- ปิดรอบคืนเฉพาะ borrowed minus issued; ของที่จ่ายแล้วต้องบันทึกคืนจริง การปล่อย stock ใช้ AFTER STATEMENT เพื่อไม่อ่าน booking ขณะ mutating
- เพิ่ม closure, expected attendees, actor/affected user แยกกัน, violation/dedupe, penalty decision times, outbox/lease, command attempts, identity/session/credential, inspection และ FAQ/message
- audit เก่าที่ไม่มี actor เก็บ `UNKNOWN`; worker ใหม่ต้องส่ง `SYSTEM` และ actor user เป็น NULL

[runtime role](../../Request/SAfordata_runtime_role.sql) เป็นขั้น provision แยกสำหรับ DBA/schema owner ที่มี CREATE ROLE แล้ว grant ให้ API login แยก ไม่ใช้ owner login ใน API Role นี้เป็นขั้นต่ำสำหรับ booking integration; admin/auth Oracle integration ยังต้องออกแบบ service และ grants ตาม command ที่ใช้จริง ไม่ใช่ backend Oracle ที่เสร็จแล้ว ตัวอย่าง [safe queries](../../Request/oracle-safe-queries.mjs) ใช้ `:name` binds, actor จาก server session และไม่ auto commit ห้าม interpolate ค่า หรือ UPDATE stock เอง

Oracle service ต้องตรวจ actor/session/scope สำหรับทุก command รวมเช็คอินและการจ่ายคืน, เวลาเช็คอิน/ยกเลิก, การปรับ room capacity/closure พร้อมยกเลิก booking ที่ได้รับผล, idempotency, audit/violation/outbox ใน transaction เดียว และไม่มี network I/O ก่อน commit; ตารางและ trigger ไม่แทน HTTP authorization หรืองาน worker

## ผลทดสอบและขอบเขต

`npm.cmd run test:sql-security` ผ่าน **9/9**: เอนจิน PostgreSQL/PGlite, insert/update/read/delete ด้วยข้อความโจมตีและ key ที่มี SQL, role permissions/RLS, constraints, terminal rollback, SQLite, HTTP validation และ Oracle driver-bind contract ตัวทดสอบ Oracle driver ใช้ connection double จึงไม่ได้พิสูจน์ Oracle trigger compile

ผลสุดท้ายหลังไฟล์ที่แก้พร้อมกันใน workspace นิ่งแล้ว: backend tests ผ่าน **44/44**, domain/audit tests ผ่าน **23/23**, frontend/backend build ผ่านทั้งหมด ข้อผิดพลาด password test และ reference UI ที่พบระหว่างงานถูกแก้ในงานที่ดำเนินพร้อมกันแล้ว งาน SQL นี้ไม่ได้ย้อนการเปลี่ยนแปลงเหล่านั้น

รัน [Oracle verification](../../Request/SAfordata_verify.sql) บน Oracle development schema หลัง migration แล้วตรวจ USER_ERRORS/constraints และทดสอบอย่างน้อยสอง connections สำหรับ overlap, quota, stock ชิ้นสุดท้าย, close/return/rollback, assignment dates และ admin override ก่อนใช้จริง มีสคริปต์ตรวจ unissued release และ SQL literal ให้แล้ว แต่ยังไม่ได้รันเพราะเครื่องนี้ไม่มี Oracle/sqlplus และ Docker daemon ไม่ทำงาน

แนวทางอ้างอิง: [node-postgres parameters](https://node-postgres.com/features/queries), [Oracle bind variables](https://node-oracledb.readthedocs.io/en/latest/user_guide/bind.html), [Oracle DBMS_ASSERT](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_ASSERT.html), [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api), [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
