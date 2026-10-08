# ตรวจระบบเซิร์ฟเวอร์ — 8 ตุลาคม 2569

บันทึกนี้เป็นผลตรวจรุ่นวันที่ 8 ตุลาคม ก่อนเพิ่มระบบรหัสผ่านและเปิด Google ทุกอีเมล ผลล่าสุดวันที่ 9 ตุลาคมและ migration เพิ่มเติมอยู่ใน [PASSWORD_AUTH.md](PASSWORD_AUTH.md)

## ผลที่ตรวจแล้ว

- สร้าง frontend/backend และตรวจ TypeScript ผ่าน เปิด API จากไฟล์ build จริงได้ พร้อมเสิร์ฟเว็บใน origin เดียวกัน เปิด worker จากไฟล์ build และหยุดกระบวนการได้
- กฎธุรกิจเดิมผ่าน 8 tests และ backend ผ่าน 14 tests รวม 22 tests
- HTTP tests ตรวจ session, สิทธิ์เจ้าของ/เจ้าหน้าที่ตามห้อง, การปิดบัญชีเพิกถอน session, logout, CSRF/Origin, คำสั่งปลอม actor/เวลา, การจองพร้อมกันมีผู้สำเร็จคนเดียว และ retry ด้วย idempotency key ไม่กันอุปกรณ์ซ้ำ
- อ่านแจ้งเตือนแล้วแยกจากสถานะส่งอีเมล และแก้ได้เฉพาะเจ้าของ ตรวจ no-show ทำซ้ำไม่เพิ่มความผิดซ้ำ และ mail lease ป้องกัน worker เก่าบันทึกทับ worker ใหม่
- ทดสอบ persistence/rollback ของทั้ง SQLite สำหรับเครื่องพัฒนา และ Postgres adapter ผ่าน PostgreSQL engine ของ PGlite ตรวจสคริปต์ Supabase จริง รวม exclusion constraint ช่วงทับซ้อน/ช่วงต่อกัน, RLS 20 ตาราง และปิดสิทธิ์ schema/table ของ browser roles
- ตรวจ dependency ด้วย `npm audit --omit=dev` ไม่พบช่องโหว่ ณ วันที่ตรวจ
- Browser ที่ 1440×1000 และ 390×844: ค้นหาห้องตามวัน/เวลา/จำนวนคน → เลือกห้องมอดินแดง → เลือกวัตถุประสงค์และยืมโปรเจกเตอร์ → ส่งคำขอ → รีโหลดพบรายการเดิม → logout → เจ้าหน้าที่อนุมัติ → ผู้จองเห็นอนุมัติแล้ว → ทำเครื่องหมายอ่านการแจ้งเตือน จำนวนที่ยังไม่อ่านลดลง
- ตรวจอัตลักษณ์: ตราภาษาไทยและฟอนต์ MorKhor 1 จากชุดต้นฉบับ ขนาดตราคงสัดส่วน หัวข้อใช้ฟอนต์อัตลักษณ์ แบบฟอร์มใช้ IBM Plex Sans Thai ตรวจหน้าค้นหาบนมือถือไม่ล้นแนวนอน และ manual design detector ไม่พบ findings
- Docker Compose ผ่านการตรวจ syntax/config โดยไม่อ่านค่าลับ

บัญชีและห้องใน browser verification เป็นข้อมูลทดสอบ ฐานข้อมูลทดสอบแยกเป็น `var/local-integration.sqlite` ไม่แตะ localStorage ของต้นแบบเดิมและไม่เชื่อมฐานข้อมูลภายนอก

## ที่ยังต้องตรวจเมื่อเปิดบริการจริง

- Supabase cloud: connection/TLS, role ที่ใช้จริง, รัน migration ใน project จริง, backup/restore และปริมาณใช้งานที่คาดหวัง
- Google: OAuth redirect/consent กับ Google Workspace จริง พร้อมโดเมนที่มหาวิทยาลัยยืนยัน ขณะนี้ทดสอบกฎ claims แต่ยังไม่ได้ทดสอบ token exchange กับบัญชีจริง
- SMTP: การรับอีเมลในมหาวิทยาลัยจริง และการ retry เมื่อผู้ให้บริการล่ม ขณะนี้อีเมลทดสอบคงสถานะรอส่ง ไม่รายงานว่าส่งแล้ว
- โฮสต์ HTTPS/reverse proxy, IP ที่เชื่อถือ, cookie จริง, monitoring และการรีสตาร์ต API/worker
- Docker image ยังไม่ได้ build/run เพราะ Docker engine ของเครื่องไม่ทำงาน แม้ Compose config ผ่านแล้ว
- GitHub Actions ยังไม่ได้รันบน GitHub; ตรวจคำสั่งเดียวกันในเครื่องแล้ว

ไม่รับรองความพร้อมรองรับทั้งมหาวิทยาลัยจากการทดสอบในเครื่อง รุ่นนี้เตรียมสำหรับเปิด pilot หลังตั้งค่าบริการและผ่านรายการตรวจจริง ดูข้อจำกัดด้านข้อมูลและ writer lock ใน `PRODUCTION_SETUP.md`
