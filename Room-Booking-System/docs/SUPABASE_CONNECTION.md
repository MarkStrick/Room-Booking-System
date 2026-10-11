# ผลเชื่อมต่อ Supabase — 9 ตุลาคม 2569

## สถานะล่าสุด 12 ตุลาคม 2569

ติดตั้ง `sql_security_hardening` แล้ว: runtime `kku_server` ไม่เป็นเจ้าของตาราง มี DML ผ่าน RLS policy เฉพาะ role ทั้ง 23 ตาราง ไม่มี CREATE/TRUNCATE/BYPASSRLS; anon/authenticated เข้า private schema ไม่ได้ constraints validated ครบ และ Security Advisor ไม่มี lints ตรวจการเชื่อมต่อจากเครื่องผ่าน TLS และ schema/permissions แล้ว SMTP ยังรอตั้งค่า ดู [ผล SQL/security](SQL_SECURITY.md) ข้อมูล ownership ด้านล่างเป็นหลักฐานก่อน migration

## สถานะล่าสุด 10 ตุลาคม 2569

ผลด้านล่างเป็นหลักฐานย้อนหลังวันที่ 9 ต.ค. รอบแก้ Audit ตรวจ cloud ผ่าน Supabase MCP ว่า project ACTIVE_HEALTHY และติดตั้ง `audit_settings` สำเร็จ มี 23 ตารางรวม app_lock ตาราง settings เปิด RLS, anon/authenticated ไม่มีสิทธิ์ ส่วน runtime kku_server มีสิทธิ์อ่าน/เขียน

เครือข่ายเครื่องนี้ resolve direct hostname ด้วย system DNS ไม่ได้ (ENOTFOUND); DNS สาธารณะคืน IPv6 แต่ TCP ไป IPv6 เป็น ENETUNREACH จึงยังต่อ API/worker ในเครื่องเข้าฐาน cloud รอบนี้ไม่ได้ ต้องรับ Session pooler endpoint ที่ถูกต้องจากหน้า Connect ตาม [runbook](OPERATIONS_RUNBOOK.md) ไม่เดา hostname หรือแก้ TLS verification

Google OAuth, SMTP/MAIL_FROM และ public HTTPS origin ยังไม่มีค่าบริการจริง การทดสอบ workflow รอบใหม่ใช้ SQLite แยกและ PostgreSQL/PGlite ไม่สร้างบัญชีหรือการจองทดสอบใน cloud ดู [ผลตรวจหลังแก้ทั้งหมด](AUDIT_FIX_VERIFICATION.md)

## หลักฐานวันที่ 9 ตุลาคม 2569

โปรเจกต์ KKU Space ใน MarkStrick's Org ภูมิภาค Singapore (`dvdjnociifxfhqkcqqsr`) ติดตั้งตาราง 22 ตารางใน `kku_private` แล้ว ใช้ PostgreSQL 17 และ migration ผ่าน Supabase MCP

API และ worker ในเครื่องใช้ฐานข้อมูลนี้ผ่าน direct connection และ TLS ที่ตรวจ certificate โดยใช้ CA จากหน้าตั้งค่า Supabase บัญชีฐานข้อมูล `kku_server` เป็นเจ้าของเฉพาะ schema/tables ของแอป ไม่มีสิทธิ์ superuser, สร้างฐานข้อมูล, สร้าง role หรือ replication ไม่ใช้รหัสผ่านหลัก `postgres` ของเจ้าของโปรเจกต์

ค่าการเชื่อมต่ออยู่ใน `.env` ที่ถูกกันออกจาก Git ใบรับรองอยู่ใน `var/supabase-ca.pem` โฮสต์ใหม่ต้องรับค่าลับผ่าน secret manager และดาวน์โหลด CA จาก Supabase ของตัวเอง ไม่คัดลอกพาธ Windows ไปใช้ใน container

ผลตรวจจริง:

- API readiness ผ่านทั้ง direct API และ proxy หน้าเว็บที่ `http://127.0.0.1:5174/api/health/ready`
- application adapter อ่านตารางทั้งหมดได้ และ worker ทำงานกับ PostgreSQL
- ทดสอบเขียน/อ่านการจองใน transaction และฐานข้อมูลปฏิเสธช่วงเวลาซ้อนด้วย exclusion constraint
- เก็บและอ่าน Argon2id credential ได้ใน transaction ทดสอบ
- rollback ยืนยันว่าไม่มีบัญชีทดสอบตกค้างใน Supabase
- RLS เปิดครบทุกตาราง; `anon` และ `authenticated` ไม่มีสิทธิ์ SELECT ในตารางส่วนตัว

Security advisor มีเพียง INFO เรื่อง RLS ไม่มี policy ซึ่งตั้งใจสำหรับ private schema ที่อ่านผ่าน server owner role เท่านั้น ดู [คำอธิบาย advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) Performance advisor แจ้ง [index ยังไม่ได้ใช้งาน](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) เพราะฐานข้อมูลใหม่ ยังไม่ลบ index ที่รองรับ constraints/queries

ยังรอตั้งค่า Google OAuth, SMTP, ผู้ดูแลคนแรกและข้อมูลห้องจริง รวมถึง HTTPS hosting เครื่องนี้ใช้ development origin และ `DEV_LOGIN=0` ไม่มีการสร้างบัญชีตัวอย่างใน cloud การสมัครจริงยังปิดจนกว่าจะส่งอีเมลยืนยันได้ และยังไม่ตรวจ booking flow ครบผ่านบัญชีจริง

MCP บันทึก migration history ของ `server_storage`, `password_auth`, `server_runtime_role` โดยใช้ version ของบริการ จึงต้องเทียบ history/pull schema ก่อนใช้ CLI `db push` ในอนาคต ห้ามรัน migration ซ้ำโดยเดาว่า timestamp ตรงกับไฟล์ local การ provision runtime role และ SCRAM verifier ไม่เผยแพร่ลง Git
