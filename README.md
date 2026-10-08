# ระบบจองห้อง — KKU Space

โปรเจกต์มหาวิทยาลัยสำหรับค้นหาห้องและจองห้อง ใช้ชื่อ KKU Space และธีมสีมหาวิทยาลัยขอนแก่น มีเว็บ React, NestJS API และ worker พร้อมสมัครด้วยอีเมล/รหัสผ่านที่เก็บด้วย Argon2id หรือเข้าสู่ระบบด้วย Google

- [คู่มือเปิดเว็บและทดลองใช้งาน](Room-Booking-System/README.md)
- [สถาปัตยกรรมระบบ](docs/SYSTEM_ARCHITECTURE.md)
- [ทบทวนฐานข้อมูลและข้อเสนอ](docs/DATABASE_REVIEW.md)
- `Request/` เอกสารความต้องการและ SQL/DDL ต้นฉบับ

เปิดทดสอบและตั้งค่าบริการจริงตาม [คู่มือโครงการ](Room-Booking-System/README.md) ตรวจการเชื่อมต่อ Supabase, Google และอีเมลด้วย `npm.cmd run check:connections` ในโฟลเดอร์ `Room-Booking-System`

เชื่อม Supabase กับ API และ worker ในเครื่องแล้ว ส่วน Google และอีเมลยังอยู่ระหว่างตั้งค่า ดู [ผลตรวจการเชื่อมต่อ](Room-Booking-System/docs/SUPABASE_CONNECTION.md) ไม่ได้นำข้อเสนอแก้ฐานข้อมูล Oracle เดิมไปใช้ ค่าลับและฐานข้อมูลทดสอบไม่อยู่ใน Git
