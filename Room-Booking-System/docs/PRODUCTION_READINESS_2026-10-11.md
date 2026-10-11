# ผลเตรียมเปิดใช้งาน — 11 ตุลาคม 2569

สถานะ: เตรียมโค้ดสำหรับ Vercel แล้ว ยังไม่ Deploy ตามคำสั่งผู้ใช้ ยังไม่ถือว่าเปิดรับผู้ใช้จริงได้จนกว่าจะตั้งบริการและตรวจบน deployment จริง

## บริการและการเข้าสู่ระบบ

- Supabase ใช้ PostgreSQL ฝั่งเซิร์ฟเวอร์ การตรวจแบบอ่านอย่างเดียวในรอบนี้ผ่าน TLS และพบ 23 ตารางที่เปิด RLS ไม่ใช้ Supabase Auth
- ระบบบัญชีของแอปใช้รหัสผ่านที่เก็บ Argon2id hash, session cookie แบบ HttpOnly และ CSRF มีโค้ดสมัคร/ยืนยันอีเมล/กู้และเปลี่ยนรหัสผ่าน
- Google OAuth เป็นทางเลือก ยังไม่มี client credentials ใน environment ที่ตรวจ ปุ่มจะซ่อนจนตั้งค่า
- SMTP ยังตั้งไม่ครบ การสมัครและกู้รหัสผ่านที่ต้องส่งอีเมลยังไม่พร้อม และหน้าเว็บซ่อนทางเข้าที่ใช้งานไม่ได้

## สิ่งที่แก้

- ปิด endpoint เลือกบัญชีทดสอบและการสร้างบัญชีตัวอย่างอัตโนมัติทุกโหมด ค่า VITE_APP_MODE ไม่ข้ามการล็อกอินอีกต่อไป
- เครื่องมือทดสอบเข้าผ่านหน้าช่วยเหลือของ ADMIN ที่ล็อกอินจริง ตรวจสิทธิ์จากเซิร์ฟเวอร์ก่อนเข้าและก่อนคำสั่งทดสอบ USER/STAFF เข้าไม่ได้ การถอนสิทธิ์หรือปิดบัญชีทำให้เข้าไม่ได้
- ข้อมูลทดสอบแยกอยู่ใน memory ของแท็บ การเปลี่ยนบทบาททดลองไม่เปลี่ยนบัญชีจริง ออกหรือโหลดใหม่แล้วล้างชุดทดลอง มีแถบเตือนและปุ่มออกทั้งคอมพิวเตอร์และมือถือ
- เพิ่มหน้าตรวจความพร้อมสำหรับ ADMIN, ข้อความกรณีเครือข่ายขัดข้อง/คำขอหมดเวลา และหน้ากู้คืนเมื่อหน้าเว็บผิดพลาด ลบข้อความสาธิตจากหน้าการใช้งานจริง
- เตรียม Vercel API adapter, routing, security headers, TLS CA แบบ environment, งานตามเวลาที่ตรวจ secret และจำกัดระยะเวลา รวมถึง auth rate counter ที่แชร์ข้าม instances ผ่านฐานข้อมูล
- เพิ่มคำสั่งสร้างผู้ดูแลคนแรกผ่าน operator terminal ที่ตรวจ allowlist และปฏิเสธการเขียนทับ ไม่เปิด HTTP route สำหรับสร้างผู้ดูแล
- เพิ่ม CI ตรวจ compiled API adapter โดยไม่มีขั้นตอน Deploy

## หลักฐานการตรวจ

| การตรวจ | ผล |
| --- | --- |
| npm run build | ผ่าน frontend/backend TypeScript และ build |
| npm test | 23 ผ่าน |
| npm run test:backend | 37 ผ่าน รวมสิทธิ์ ADMIN, การปิด login ทดสอบ, cron secret, limiter ข้าม instances และ bootstrap |
| npm run test:vercel | ผ่าน compiled handler ในเครื่อง: config, password login, ADMIN authorization, test login 403 และ API ที่ไม่มี 404 |
| npm audit --omit=dev | ไม่พบช่องโหว่ใน dependencies สำหรับใช้งานจริง |
| Browser ADMIN | login จริง → readiness → sandbox → ทดลอง USER → ออกกลับบัญชี ADMIN |
| Browser USER | ไม่มีปุ่ม sandbox, readiness หรือแผงเครื่องมือทดสอบ |
| Browser มือถือ 390×844 | เห็นแถบเตือนและปุ่มออก ไม่มีการล้นแนวนอน โหลดใหม่ออกจาก sandbox |
| Browser console รอบตรวจสุดท้าย | ไม่พบ error |

ใช้ข้อมูล fixture ใน SQLite แยกจากฐานจริงสำหรับ API/browser และไม่ได้โหลดค่าลับจาก .env ไม่สร้างบัญชีจริง ไม่ส่งอีเมล ไม่แก้ข้อมูล Supabase และไม่ Deploy

ภาพตรวจ: [คอมพิวเตอร์](verification/production-2026-10-11/admin-sandbox-desktop.png), [มือถือ](verification/production-2026-10-11/admin-sandbox-mobile.png), [ล็อกอินมือถือ](verification/production-2026-10-11/login-mobile.png)

## สิ่งที่ยังต้องตั้งก่อนเปิดจริง

1. เลือกบริการ SMTP และตั้งผู้ส่งที่ยืนยันแล้ว พร้อมทดสอบอีเมลจริง
2. ตั้ง Vercel environment, HTTPS origin, database CA/connection และ secrets แยก Preview/Production
3. สร้างผู้ดูแลคนแรกและเติมอาคาร ห้อง เวลาทำการ อุปกรณ์ FAQ และช่องทางติดต่อจริง
4. เลือก scheduler: config ปัจจุบันใช้ cron ทุกนาทีสำหรับ Pro/Enterprise; ถ้าใช้ Hobby ต้องใช้ scheduler ภายนอกตามคู่มือ ไม่มีการสมัครหรือซื้อบริการในรอบนี้
5. เมื่อผู้ใช้สั่งให้ Deploy จึงตรวจ Preview จริงทั้ง routing/native dependencies, cookie/CSRF, SMTP, cron, การจองครบวงจร และ backup/restore/load ตามปริมาณเป้าหมาย

ดูค่าที่ต้องตั้งและขั้นตอนใน [คู่มือ Vercel](VERCEL_SETUP.md) การทดสอบ compiled handler ในเครื่องไม่ยืนยันพฤติกรรมบนแพลตฟอร์ม Vercel
