# เปิดใช้งาน KKU Space กับ Supabase

รุ่นนี้มี React frontend, NestJS API และ worker แยกกระบวนการ โดยใช้ Supabase PostgreSQL เป็นฐานข้อมูลกลาง มีอีเมล/รหัสผ่านที่เก็บด้วย Argon2id และ Google OpenID Connect ผู้ใช้สมัครเองและ Google ใช้ได้ทุกอีเมลตามคำขอล่าสุดวันที่ 9 ตุลาคม 2569 ใช้ session cookie แบบ HttpOnly ไม่ใช้ Supabase Auth หรือเก็บ token ใน localStorage ดู [ระบบรหัสผ่านและ migration ใหม่](PASSWORD_AUTH.md)

**ยังไม่ได้ติดตั้งใน Supabase หรือโฮสต์สาธารณะ** การทดสอบในเครื่องใช้ฐานข้อมูลทดสอบและบัญชีตัวอย่าง การเปิดจริงต้องตั้งค่าบริการด้านล่างและตรวจด้วยบัญชีและอีเมลจริงก่อนรับผู้ใช้

## 1. ฐานข้อมูลใหม่

สร้าง Supabase project สำหรับระบบนี้ เปิด SQL Editor แล้วรัน `supabase/migrations/202610080001_server_storage.sql` หนึ่งครั้ง เก็บประวัติการรัน migration ของโครงการไว้ สคริปต์สร้าง schema `kku_private` ใหม่ ไม่ใช่สคริปต์ย้ายข้อมูล Oracle และไม่แก้ไฟล์ข้อเสนอเดิม

ตารางมี RLS และไม่มีสิทธิ์สำหรับ `anon`/`authenticated` ไม่เพิ่ม `kku_private` ใน exposed schemas ของ Data API เบราว์เซอร์เรียก API ของ NestJS เท่านั้น บัญชีเชื่อมฐานข้อมูลฝั่งเซิร์ฟเวอร์ต้องเป็นเจ้าของตารางหรือ role ที่ได้รับสิทธิ์และข้าม RLS ได้ตามที่ผู้ดูแลฐานข้อมูลกำหนด

จากปุ่ม Connect คัดลอก connection string ไปตั้ง `DATABASE_URL` ฝั่งเซิร์ฟเวอร์ สำหรับเซิร์ฟเวอร์ถาวรใช้ direct connection หากรองรับ IPv6 หรือ session pooler หากใช้ IPv4 เท่านั้น ตาม [เอกสาร Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) encode อักขระพิเศษในรหัสผ่านของ URL

การเชื่อมต่อเปิด TLS และตรวจ certificate เสมอ หากเครื่องโฮสต์ไม่เชื่อถือ CA ให้ใส่ certificate ที่ถูกต้องใน `DATABASE_CA_PATH` ใช้ path ที่อ่านได้ในเครื่อง/container ห้ามแก้เป็น `rejectUnauthorized: false`

ระบบเก็บข้อมูลโดเมนเป็น JSONB แยกตาราง พร้อมคอลัมน์และ constraint สำหรับการจอง: foreign key, ช่วงเวลา, สถานะ และ exclusion constraint กันห้องซ้อน คำสั่งทุกชนิดรวมทั้ง worker ใช้ transaction และ writer lock เดียวเพื่อกันโควตา/อุปกรณ์ผิดจากการเขียนพร้อมกัน

## 2. บัญชี Google ทุกอีเมล และบัญชีรหัสผ่าน

สร้าง Google OAuth client ประเภท Web application ใส่ callback **ตรงกับ** `${APP_ORIGIN}/api/auth/google/callback` เช่น `https://rooms.example.edu/api/auth/google/callback` ตั้งค่า consent screen และการอนุญาตแอปกับ Google Workspace ของมหาวิทยาลัยให้เหมาะกับกลุ่มผู้ใช้

ตั้ง `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` และ `ALLOW_PUBLIC_GOOGLE=1` เพื่อรองรับ Google ทุกโดเมน รุ่นนี้ตรวจ `email_verified` จาก token ที่ Google ยืนยันและผูกบัญชีตาม `sub` ไม่เชื่อการส่งอีเมลหรือบทบาทมาจากเว็บ ดู [เอกสาร Google](https://developers.google.com/identity/openid-connect/openid-connect)

คำขอล่าสุดเปิดรับทุกอีเมล จึงไม่ต้องตั้งรายการโดเมน Google credentials เป็นตัวเลือกสำหรับช่องทาง Google ส่วนอีเมล/รหัสผ่านต้องรัน migration ใหม่และตั้ง SMTP เพื่อยืนยันอีเมลก่อนเปิดสมัคร หากในอนาคตต้องกลับมาจำกัดโดเมน ให้ตั้ง `ALLOW_PUBLIC_GOOGLE=0` และ `ALLOWED_GOOGLE_DOMAINS` ตามนโยบายที่ตกลงใหม่

ใส่อีเมลผู้ดูแลเริ่มต้นที่ยืนยันแล้วใน `BOOTSTRAP_ADMIN_EMAILS` ก่อนเข้าสู่ระบบครั้งแรก บัญชีใหม่ทั่วไปได้สิทธิ์ผู้จอง ผู้ดูแลเพิ่มสิทธิ์เจ้าหน้าที่และมอบหมายห้องจากหน้า “บัญชีและสิทธิ์” หลังสร้างบัญชีผู้ดูแลสำเร็จให้ลบ bootstrap list การปิดบัญชีเพิกถอน session ทันที

## 3. อีเมลและค่าลับ

คัดลอก `.env.example` เป็น `.env` หรือใส่ค่าใน secret manager ของโฮสต์ ตั้ง `APP_ORIGIN` เป็น origin HTTPS จริง ไม่มี path ตั้ง SMTP และ `MAIL_FROM` ตามบัญชีที่ได้รับอนุญาต `SMTP_SECURE=1` ใช้ TLS ตั้งแต่เชื่อมต่อ เช่น port 465 ส่วน port 587 ใช้ `SMTP_SECURE=0` และบังคับ STARTTLS

ตั้ง SPF/DKIM/DMARC ตามผู้ให้บริการอีเมลขององค์กร ทดสอบส่งถึงบัญชีมหาวิทยาลัยจริง ค่าลับทั้งหมดอยู่บนเซิร์ฟเวอร์ ไม่ใช้ตัวแปร `VITE_` และไม่ commit `.env` ไม่ต้องส่งรหัสผ่านในแชต

worker ประมวลผล no-show/จบรอบจากเวลาจริง และส่งอีเมลจาก transactional outbox เมื่อ SMTP ยอมรับจึงเปลี่ยนเป็นส่งแล้ว หากล้มเหลวจะ retry แบบหน่วงเวลาและแสดงส่งไม่สำเร็จหลังครบ 5 ครั้ง การส่งแล้วไม่ยืนยันว่าผู้รับเปิดอ่าน หาก SMTP รับอีเมลแต่กระบวนการหยุดก่อนบันทึกผล อีเมลอาจซ้ำได้

## 4. เปิดเซิร์ฟเวอร์

ใช้ Node.js 24 และเปิด terminal ที่ root โครงการ:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:backend
npm.cmd run build
npm.cmd start
```

เปิด worker เป็นอีกกระบวนการด้วย `npm.cmd run worker` จัดการทั้งสองด้วย service manager และตั้งให้กลับมาทำงานเมื่อเครื่องรีสตาร์ต API เสิร์ฟไฟล์เว็บที่สร้างแล้วจาก `apps/web/dist` ใน origin เดียวกัน ไม่ใช้ Vite preview เป็นเซิร์ฟเวอร์สาธารณะ

มี Dockerfile และ `compose.yaml` ให้สร้าง image และเปิด API/worker ด้วย `docker compose up -d --build` ค่า environment อ่านจาก `.env` พอร์ต API เปิดเฉพาะ loopback ของเครื่องโฮสต์ ตั้ง reverse proxy HTTPS ให้ส่ง `/` และ `/api` ไป `127.0.0.1:3001` และเขียน `X-Forwarded-For` เองแทนการเชื่อค่าจากผู้ใช้

ตั้ง `TRUST_PROXY` เป็น IP/CIDR ของ proxy ที่ควบคุมเท่านั้น เช่น `loopback` สำหรับ Node ที่อยู่บนเครื่องเดียวกัน เมื่อใช้ Docker ต้องใช้ IP ของ gateway/proxy ที่ container เห็นจริงพร้อม `/32` สำหรับ IPv4 ห้ามใช้ `true`, จำนวน hop แบบเปิดกว้าง หรือ `0.0.0.0/0` หากไม่ตั้งค่าจะจำกัดคำขอตาม IP การเชื่อมต่อโดยตรงซึ่งอาจนับผู้ใช้หลัง proxy รวมกัน

ตรวจ `/api/health/live` และ `/api/health/ready` ตั้ง monitoring ให้แจ้งเมื่อ API หรือ worker หยุด บันทึก API มี request ID, เส้นทาง, สถานะ และเวลาตอบ ไม่บันทึก query token หรือ body ให้โฮสต์แยกเก็บ log และทำ rotation

## 5. เตรียมข้อมูลและทดสอบก่อนเปิด

ฐานข้อมูลใหม่เริ่มว่าง ไม่มีบัญชีตัวอย่างหรือห้องตัวอย่างใน production ให้ผู้ดูแลเข้าสู่ระบบ เพิ่มอาคาร ห้อง อุปกรณ์ เวลาทำการ และวันหยุด แล้วให้เจ้าหน้าที่เข้าสู่ระบบก่อนมอบหมายห้อง

ตรวจเส้นทางจริง: สมัครและยืนยันอีเมล/เข้า Google → ค้นหาวัน/เวลา/จำนวนคน → ส่งคำขอ → เจ้าหน้าที่ที่รับผิดชอบอนุมัติ → ผู้จองเห็นสถานะ → รับอีเมล → เช็คอิน/จบรอบ ตรวจรหัสผิด/ลืมรหัส/เปลี่ยนรหัสและบัญชี Google ภายนอก ตรวจกดย้ำและส่งพร้อมกันไม่สร้างการจอง/กันอุปกรณ์ซ้ำ ตรวจ logout และปิดบัญชี รวมถึงการกู้คืนจาก backup

เปิด pilot ด้วย API **หนึ่ง instance** และ worker หนึ่ง instance ก่อน ตัวจำกัดคำขอยังอยู่ใน memory ต่อ instance การอ่าน state ดึงข้อมูลทั้งชุดและกรองตามสิทธิ์ การเขียนใช้ lock รวม จึงยังไม่ได้รับรองปริมาณผู้ใช้ทั้งมหาวิทยาลัย ให้ load test จากปริมาณที่คาดหวังก่อนขยาย และปรับ pagination, การอ่านเฉพาะผู้ใช้/ห้อง และ lock ตามทรัพยากรเมื่อจำเป็น

กำหนดผู้รับผิดชอบ backup/restore, อายุข้อมูลการจอง/ประวัติการใช้ และการแจ้งเหตุขัดข้องร่วมกับหน่วยงานก่อนเริ่มรับข้อมูลจริง

## ทดลองในเครื่อง

ไม่ต้องกรอกบริการ cloud เพื่อทดสอบในเครื่อง: คัดลอก `.env.development.example` เป็น `.env` จากนั้น build เปิด API และ Vite preview คนละ terminal `npm.cmd start` และ `npm.cmd run preview` เปิด `http://127.0.0.1:5174` ปุ่มบัญชีทดสอบอยู่ในรายละเอียดสำหรับทดสอบในเครื่อง ข้อมูลเก็บใน `var/kku-development.sqlite` ไม่ใช่ browser localStorage

หากพัฒนาเว็บผ่าน `npm.cmd run dev` ที่ port 5173 ให้แก้ `APP_ORIGIN` ตามนั้นและรีสตาร์ต API การข้าม origin ถูกปฏิเสธตามปกติ โหมดต้นแบบเดิมเลือกโดย `VITE_APP_MODE=demo` ก่อน build และแยกเก็บ localStorage เดิม

## ขอบเขตที่คงไว้

ไม่แก้ข้อเสนอ `../docs/SYSTEM_ARCHITECTURE.md`, `../docs/DATABASE_REVIEW.md` หรือ SQL/DDL ใน `../Request` ไม่เพิ่ม pending timeout, lead time 4 ชั่วโมง หรือ late-cancel record โดยไม่มีนโยบายที่ยืนยันแล้ว FAQ ใช้คำตอบที่เตรียมไว้ รายงานชั่วโมงยังเป็นประมาณการ รุ่นจริงยังไม่เปิดรายชื่อผู้ร่วมใช้ห้องจากทะเบียนบุคคล และการคืนอุปกรณ์เป็นการคืนยอดกันจอง ไม่ใช่การตรวจรับของจริง
