# การทดสอบและดูแลระบบ

## เปิดใช้งาน

ใช้หนึ่ง API instance และ worker ที่ใช้ฐานเดียวกัน ตั้ง production environment ตาม PRODUCTION_SETUP ใช้ HTTPS, DEV_LOGIN=0, DB_DRIVER=postgres และ runtime role ที่เข้าถึงเฉพาะ kku_private ตรวจ migrations ใน cloud ก่อนส่งเวอร์ชันใหม่: settings ต้องมี RLS, browser roles ไม่มีสิทธิ์ และ runtime role อ่าน/เขียนได้ อย่า db push โดยเดาว่า local timestamps ตรง remote history

Worker ตรวจทุก 30 วินาที บันทึก heartbeat; หากเกิน 2 นาที /api/admin/operations แสดง workerHealthy=false คิวอีเมล retry สูงสุด 5 ครั้งและ lease fencing; readiness DB ไม่แทนการตรวจอีเมลเข้ากล่องจริง ผู้ดูแลติดตามคิวและ retry ได้

## เชื่อม Supabase จากเครือข่าย IPv4

ใน project KKU Space เปิด Connect → Session pooler แล้วรับ hostname/port/username ที่บริการแสดงจริง ใช้ runtime account ตามสิทธิ์เดิมและ CA ที่ถูกต้อง ห้ามเดาชื่อ pooler หรือใช้รหัสผ่านหลักแทน runtime role การตรวจวันที่ 10 ต.ค. พบ direct hostname resolve ผ่าน DNS สาธารณะเป็น AAAA แต่ TCP IPv6 จากเครื่องเป็น ENETUNREACH จึงยังไม่ใช่หลักฐานว่ารหัสผ่าน/schema ผิด

Google/SMTP ต้องใช้ credentials ของเจ้าของบัญชีบริการ เติมผ่าน secret manager/.env ที่ ignore แล้วรัน check:connections การตรวจ SMTP authentication ไม่ยืนยัน inbox delivery ให้ใช้บัญชีทดสอบที่ได้รับอนุญาตตรวจสมัคร → ยืนยัน → จอง → อนุมัติ/ยกเลิก → รับอีเมลจริงก่อนเปิด pilot

## สำรองและคืนข้อมูล PostgreSQL

1. สำรอง schema/data และ migration history ด้วยเครื่องมือ backup ของ Supabase หรือ pg_dump บนโฮสต์ที่ต่อฐานได้ เก็บไฟล์เข้ารหัสนอก public web root
2. คืนลงฐานทดสอบแยก ไม่ทับฐาน production ใช้ pg_restore ตาม format ของ dump
3. ตรวจตาราง/สิทธิ์/RLS/constraint และจำนวน booking/inspection/settings/outbox เทียบกับสำรอง
4. เปิดแอปกับฐานที่คืน แล้วตรวจ login, booking overlap, history, stock outstanding และ worker queue
5. บันทึกเวลา snapshot, เวลาที่ใช้คืน และข้อมูลสูญเสียที่ยอมรับได้ตามเป้าหมาย pilot

รอบนี้ทดสอบ SQLite backup/restore จริงใน temp directory และ PostgreSQL adapter/PGlite ไม่ได้คืน production cloud เพื่อป้องกันข้อมูลจริง

## ปริมาณใช้งานและการขยาย

local regression ส่ง 50 read requests พร้อมกัน ตรวจว่าได้ 200 ทุกคำขอ และชุด concurrent booking เดิมตรวจหนึ่งผู้ชนะ การทดสอบนี้ไม่รับรอง 50 users ต่อเนื่องใน production ต้องกำหนดเป้าหมายและทดสอบบน preview ด้วยข้อมูลตัวแทนก่อนขยาย

หากต้องใช้หลาย API instances ให้เลือก distributed rate limiter และปรับ repository เป็น query ตาม scope พร้อม load/lock benchmarks ก่อนเพิ่ม instances ไม่ถอด transaction lock โดยไม่มีกฎ quota/stock ที่รับ concurrent writers แทน

API contract ที่ `/api/openapi.json` อธิบาย cookie session, CSRF, idempotency และ command/access schemas ใช้ร่วมกับ contracts ที่ตรวจ request จริง ไม่ถือเป็นการรับรอง capacity หรือการเปลี่ยน API ทั้งระบบเป็น resource endpoints
