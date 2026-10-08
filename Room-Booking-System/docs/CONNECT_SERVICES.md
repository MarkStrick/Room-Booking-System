# เชื่อมบริการจริง

ไฟล์ `.env.connection` ที่ root ใช้เตรียมค่าบริการจริงในเครื่องและถูกกันออกจาก Git ไม่ใช้โดย API/worker จนกว่าจะเปิดใช้งานจริง จึงไม่เปลี่ยนข้อมูลทดสอบที่เว็บกำลังใช้ ไม่ส่งค่าลับในแชต

1. Supabase: สร้าง project สำหรับระบบนี้ รัน migration ทั้งสองไฟล์ใน `supabase/migrations` ตามลำดับ แล้วใส่ PostgreSQL connection string ใน `DATABASE_URL` ไม่ใช้ anon key แทน connection string สำหรับเครือข่าย IPv4 ใช้ Session pooler จากปุ่ม Connect โดยตรง ดู [Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
2. Google Cloud: สร้าง OAuth client แบบ Web application ใส่ Client ID/Secret ในไฟล์ และตั้ง Redirect URI เป็น `${APP_ORIGIN}/api/auth/google/callback` เลือกกลุ่มผู้ใช้ External เพื่อรองรับ Google ทุกอีเมล และจัดการ consent screen ตามสถานะการเผยแพร่ ดู [Google](https://developers.google.com/identity/openid-connect/openid-connect)
3. อีเมล: ใส่ SMTP ของบริการที่บัญชีนี้มีสิทธิ์ใช้ รวมถึง `MAIL_FROM` ที่ผู้ให้บริการอนุญาต port 587 ใช้ `SMTP_SECURE=0` (บังคับ STARTTLS) หรือ port 465 ใช้ `SMTP_SECURE=1`
4. เว็บ: ใส่ HTTPS URL จริงใน `APP_ORIGIN` และอีเมลผู้ดูแลคนแรกใน `BOOTSTRAP_ADMIN_EMAILS` ก่อนสมัครและยืนยันอีเมลครั้งแรก Google credentials ต้องตรงกับ URL นี้

รัน `npm.cmd run check:connections` เพื่อเช็ค PostgreSQL/TLS ตารางและสิทธิ์เซิร์ฟเวอร์ การเข้าถึง Google discovery และ SMTP authentication โดยไม่แก้ฐานข้อมูลหรือส่งอีเมล ผลตรวจไม่แสดงค่าลับ Google discovery ไม่ยืนยัน OAuth client ส่วน SMTP verify ไม่ยืนยันการรับอีเมลจริง

เมื่อตรวจผ่านแล้ว นำค่าจาก `.env.connection` ไปใส่ `.env` หรือ secret manager ของโฮสต์ ก่อนเปิด API/worker ตาม [ขั้นตอน production](PRODUCTION_SETUP.md) ตัวตรวจจะอ่าน `.env.connection` ทับ `.env` หากทั้งสองไฟล์มีอยู่ ให้ย้าย/ลบไฟล์เตรียมหลังนำค่าไปใช้เพื่อป้องกันผลตรวจต่างจากค่าที่เซิร์ฟเวอร์ใช้

ต้องทดสอบสมัคร → รับและยืนยันอีเมล → เข้าด้วยรหัสผ่าน/Google → จอง → อนุมัติ → รับอีเมลจริงก่อนรับผู้ใช้ ห้ามอ้างว่าเชื่อมครบเพียงเพราะกรอกค่าหรือผ่านการตรวจ discovery
