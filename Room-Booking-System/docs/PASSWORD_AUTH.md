# เข้าสู่ระบบด้วยรหัสผ่าน — 9 ตุลาคม 2569

ผู้ใช้สมัครและตั้งรหัสผ่านเองได้ ยืนยันอีเมลก่อนใช้งาน แล้วเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน Google Login เปิดให้ใช้อีเมลทุกโดเมนตามคำขอล่าสุด ค่าสำหรับทั้งสองช่องทางใช้ `ALLOW_PUBLIC_GOOGLE=1` ซึ่งเป็นค่าปกติ ผู้ใช้ทั่วไปได้รับบทบาทผู้จอง ส่วนผู้ดูแลเริ่มต้นใช้อีเมลใน `BOOTSTRAP_ADMIN_EMAILS` ที่ตั้งฝั่งเซิร์ฟเวอร์และต้องยืนยันอีเมลก่อน ไม่รับ role จากแบบฟอร์มสมัคร

## ค่าที่ต้องตั้งก่อนเปิดจริง

1. ใน Supabase project ของระบบนี้ รัน `supabase/migrations/202610080001_server_storage.sql` หากยังไม่เคยรัน แล้วรัน **`supabase/migrations/202610090001_password_auth.sql`** สคริปต์ใหม่เพิ่ม `kku_private.credentials` และ `kku_private.password_tokens` ไม่แก้ข้อเสนอหรือ Oracle ต้นฉบับ
2. ตั้ง `DATABASE_URL` ฝั่งเซิร์ฟเวอร์ตามคู่มือ `PRODUCTION_SETUP.md` ไม่มีการส่ง database password หรือ service credentials ไป frontend
3. ตั้ง SMTP และ `MAIL_FROM` สำหรับส่งยืนยันอีเมลและลิงก์ตั้งรหัสผ่านใหม่ การสมัคร/ขอลิงก์จะปิดจนกว่าจะตั้งผู้ส่งอีเมล ไม่เปิดบัญชีให้ข้ามการยืนยันใน production
4. ถ้าต้องการ Google Login ให้ตั้ง `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` และ callback `${APP_ORIGIN}/api/auth/google/callback` ไม่บังคับ Google credentials สำหรับระบบรหัสผ่าน แต่ยังต้องตั้ง Google OAuth consent ให้รองรับผู้ใช้ภายนอกของแอปจริง
5. ตั้ง `APP_ORIGIN` เป็น HTTPS ของเว็บจริง แล้ว build และรีสตาร์ต API/worker หลังรัน migration การทดสอบในเครื่องใช้ SQLite เท่านั้น ยังไม่ได้ส่ง migration นี้ไป Supabase cloud

## การเก็บและตรวจรหัสผ่าน

ใช้ Argon2id ผ่าน node-argon2: memory 64 MiB, 3 iterations, parallelism 1, salt สุ่ม 16 bytes ต่อการแฮช และ digest 32 bytes เก็บ PHC hash รวมค่า parameters และ salt ใน private credentials table รหัสผ่านยาว 12–128 ตัวอักษร รองรับภาษาไทย ไม่เก็บ plaintext และไม่ใช้การเข้ารหัสที่ถอดกลับได้ ดูหลักการจาก [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) และ [node-argon2](https://github.com/ranisalt/node-argon2)

credential แยกจาก user profile และผล API ไม่มี hash มีเพียง `hasPassword` สำหรับเลือกแสดงตั้ง/เปลี่ยนรหัสผ่าน ตารางเปิด RLS และปิดสิทธิ์ `anon`/`authenticated` เบราว์เซอร์ใช้ NestJS API ที่ตรวจสิทธิ์ ไม่เรียก credentials table โดยตรง

รหัสผิดครบ 5 ครั้งจะระงับการลองของบัญชีนั้น 15 นาที พร้อม IP rate limit เดิมของ auth ทุก endpoint ตรวจ Origin; การตั้ง/เปลี่ยนรหัสผ่านขณะล็อกอินตรวจ CSRF และรหัสเดิมด้วย หากยังไม่มีรหัสผ่านต้องเพิ่งเข้าสู่ระบบภายใน 15 นาที การแฮชทำงานนอก database lock และจำกัดพร้อมกันไม่เกิน 4 งานต่อ API process

ลิงก์ยืนยัน/ตั้งรหัสผ่านใหม่ใช้ token สุ่ม 32 bytes หมดอายุ 30 นาที ใช้ได้ครั้งเดียว ฐานข้อมูลเก็บ SHA-256 ของ **token สุ่ม** ไม่เก็บ token ดิบ การแฮชรหัสผ่านยังเป็น Argon2id เสมอ token อยู่ใน fragment ของลิงก์ ไม่อยู่ใน HTTP query/log การเปิดลิงก์อย่างเดียวไม่ยืนยันหรือเปลี่ยนบัญชี ต้องกดปุ่มดำเนินการก่อน

เปลี่ยนรหัสผ่านจากหน้าข้อมูลส่วนตัวทำให้ session ของอุปกรณ์อื่นและลิงก์ตั้งรหัสเดิมหมดสิทธิ์ เหลือ session ใหม่ของอุปกรณ์ที่เปลี่ยน ถ้าตั้งผ่านลิงก์ลืมรหัสผ่านจะออกจากทุกอุปกรณ์และต้องเข้าสู่ระบบใหม่ ไม่มีการแจ้งว่าบัญชีใดมีอยู่ผ่านข้อความรหัสผิดหรือข้อความขอลิงก์

บัญชีที่ยืนยัน Google แล้วตั้งรหัสผ่านได้ในหน้า “ข้อมูลส่วนตัว” ไม่ผูกบัญชี Google กับบัญชีรหัสผ่านจากการเห็นอีเมลเหมือนกันเพียงอย่างเดียว หากเคยสมัครด้วยรหัสผ่านและ Google พบอีเมลซ้ำ ให้ใช้วิธีเข้าสู่ระบบเดิม เพื่อป้องกันการผูกบัญชีผิดคน

## ตรวจแล้วและที่ต้องตรวจจริง

ทดสอบ hash/salt ภาษาไทย, password login, CSRF, รหัสผิด, lockout/หมดเวลา, เปลี่ยนรหัสและเพิกถอน session, สมัครยืนยันอีเมล, token ใช้ซ้ำ/หมดอายุ, reset, SMTP ล้มเหลวไม่สร้างบัญชี, Google verified email ทุกโดเมน และ Postgres adapter บันทึก/อ่าน credential ได้

Backend ผ่าน 18 tests พร้อมกฎธุรกิจเดิม 8 tests รวม 26 tests Build และ production dependency audit ผ่าน ตรวจหน้า login desktop/mobile และเข้าใช้ด้วยบัญชีทดสอบที่แยกไว้ในฐานข้อมูล local แล้ว Supabase connection/TLS และการเก็บ Argon2id บนฐานข้อมูล cloud ตรวจผ่านตาม [ผลตรวจ](SUPABASE_CONNECTION.md) การทดสอบอีเมลใช้ตัวส่งจำลอง ยังต้องตรวจรับอีเมลจริงและ Google token exchange ก่อนเปิดสาธารณะ

## ลองหน้าจอในเครื่อง

ในเครื่องนี้มีบัญชีสมมติสำหรับตรวจ password login เท่านั้น: `password.qa.20261009@example.invalid` รหัส `Local test passphrase 2026!` บัญชีนี้อยู่ใน `var/local-integration.sqlite` เท่านั้น ไม่สร้างใน Supabase หรือ production และไม่ใช่บัญชีผู้ใช้จริง

สมัครสมาชิกจริงและลืมรหัสผ่านต้องตั้ง SMTP ก่อน ส่วนบัญชี Google เดิมสามารถไปที่ “ข้อมูลส่วนตัว” เพื่อตั้งรหัสผ่านของตัวเองได้ ไม่ควรส่งรหัสผ่านจริงในแชต
