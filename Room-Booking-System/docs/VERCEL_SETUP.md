# เตรียม KKU Space สำหรับ Vercel — 11 ตุลาคม 2569

Deploy แล้วเมื่อ 12 ตุลาคม 2569 ดู [ผล deploy และข้อจำกัดที่ยังเหลือ](DEPLOYMENT_2026-10-12.md) ส่วนคำแนะนำด้านล่างเป็นรายละเอียดการตั้งค่าเดิม

## รูปแบบที่เตรียมไว้

- ใช้ project root `Room-Booking-System`, Node.js 24, ติดตั้งด้วย `npm ci`, build ด้วย `npm run build` และส่งหน้าเว็บจาก `apps/web/dist`
- `api/index.mjs` เรียก NestJS/Express ที่ build แล้ว โดยไม่เปิด port และใช้ app/database pool ซ้ำใน function ที่ยังทำงานอยู่
- `/api/*` เข้าสู่ API ผ่าน rewrite; frontend และ API อยู่ origin เดียวกัน จึงใช้ HttpOnly cookies/CSRF ตามเดิม
- ใช้ Supabase PostgreSQL ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ใช้ SQLite บน Vercel ไม่ส่ง credentials ไป browser
- Auth rate limit บน Vercel บันทึก counter ใน `kku_private.attempts` โดย hash IP ด้วย `RATE_LIMIT_SECRET` และใช้ transaction เดียวกันข้าม instances ไม่ต้องเพิ่ม migration ตัว limiter รวม `/api` ยังเป็นต่อ instance ควรเสริม Vercel Firewall และทดสอบปริมาณเป้าหมายก่อนขยาย
- ตั้งงานอัตโนมัติที่ `/api/internal/jobs` ทุกนาที ตรวจ `CRON_SECRET` ก่อนทำงาน ประมวลผล lifecycle, heartbeat และส่งอีเมลในรอบที่จำกัดเวลา คิวและ lease เก็บใน PostgreSQL

## การเลือก scheduler ก่อน Deploy

ไฟล์ `vercel.json` เตรียม cron ทุกนาทีสำหรับ Vercel Pro/Enterprise เพราะระบบต้องตรวจคำขอหมดเวลา เช็คอินและ no-show เป็นระยะ Hobby จำกัด cron เป็นวันละครั้ง จึงใช้ตารางนี้ไม่ได้ อย่าเปลี่ยนเป็นวันละครั้งแล้วถือว่าระบบจองพร้อม

หากเลือก Hobby ให้นำรายการ `crons` ออกจาก config และใช้ scheduler ภายนอกที่ได้รับอนุญาตเรียก HTTPS `GET /api/internal/jobs` ทุกนาทีพร้อม `Authorization: Bearer <CRON_SECRET>` ไม่มีการสมัครหรือซื้อ scheduler ในรอบนี้ ดู [ข้อจำกัด Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) และ [การป้องกัน endpoint](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

## ค่าที่ต้องใส่ใน Environment ของ Vercel

ตั้งแยก Production และ Preview ใช้ฐานทดสอบแยกสำหรับ Preview เพื่อไม่ให้ลองระบบบนข้อมูลผู้ใช้จริง

| ค่า | การตั้งค่า |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_ORIGIN` | HTTPS origin จริงที่ผู้ใช้เปิด ไม่มี path และตรงกับ Google callback |
| `DB_DRIVER` | `postgres` |
| `DATABASE_URL` | connection string ของ server role ใช้ Session pooler จาก Supabase Connect เมื่อเครือข่ายต้องการ IPv4 |
| `DATABASE_CA_PEM` | CA certificate ที่เชื่อถือจาก Supabase ใส่ PEM เต็มได้ รองรับ `\n` แบบ literal |
| `DATABASE_CA_PATH` | เว้นว่างบน Vercel พาธเครื่อง Windows ใช้บนโฮสต์ไม่ได้ |
| `DEV_LOGIN` | `0`; endpoint เดิมถูกปิดทุกโหมดแล้ว |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | ตามบริการส่งอีเมลที่เลือก 587/STARTTLS หรือ 465/TLS |
| `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | credential และผู้ส่งที่บริการอนุญาต |
| `CRON_SECRET` | random secret อย่างน้อย 32 ตัวอักษร ใช้เฉพาะ server/scheduler |
| `RATE_LIMIT_SECRET` | random secret อีกชุดอย่างน้อย 32 ตัวอักษร คงค่าเดิมใน instances ของ deployment เดียวกัน |
| `ALLOW_PUBLIC_GOOGLE` | `0` เพื่อจำกัดบัญชีมหาวิทยาลัย |
| `ALLOWED_GOOGLE_DOMAINS` | `kkumail.com,kku.ac.th` |
| `BOOTSTRAP_ADMIN_EMAILS` | อีเมลผู้ดูแลคนแรกที่ได้รับอนุญาต แล้วนำออกหลังตั้งค่าบัญชี |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | จำเป็น: Google เป็นช่องทางเข้าสู่ระบบเดียว หากไม่ตั้งจะยังเข้าสู่ระบบไม่ได้ |

ไม่ตั้งค่าลับด้วยชื่อขึ้นต้น `VITE_` และไม่อัปโหลด `.env`, `var`, credentials หรือ fixtures ไป deployment

## ผู้ดูแลคนแรก

กำหนด `BOOTSTRAP_ADMIN_EMAILS` เป็นอีเมล Google ของผู้ดูแลก่อนเข้าสู่ระบบครั้งแรก ระบบตรวจบัญชี Google ที่ยืนยันแล้วและสร้างบทบาท ADMIN ให้ จากนั้นนำอีเมลออกจาก allowlist คำสั่ง `admin:bootstrap` แบบรหัสผ่านถูกยกเลิกแล้ว ดู [คู่มือ Google Login](MOBILE_UI_GOOGLE_LOGIN.md)

ผู้ดูแลเข้าที่ **คำแนะนำและช่วยเหลือ → ความพร้อมของระบบ** เพื่อตรวจการตั้งค่า และ **เปิดพื้นที่ทดสอบ** เพื่อทดลองข้อมูลจำลอง ข้อมูลจำลองอยู่ในหน่วยความจำของแท็บ ไม่ใช้ localStorage และไม่เขียนฐานจริง ออกจากพื้นที่ทดสอบแล้วกลับบัญชีผู้ดูแลเดิม

## ตรวจหลังตั้งค่าบริการและก่อนรับผู้ใช้

1. ตรวจ database/TLS/schema ด้วย `npm run check:connections` โดยไม่ส่งอีเมล
2. ตรวจ Google Login → callback → session → ออกจากระบบ ด้วยบัญชี Google จริง
3. เติมอาคาร ห้อง เวลาทำการ อุปกรณ์ และช่องทางติดต่อจริงผ่านผู้ดูแล
4. ตรวจจอง → อนุมัติ → เช็คอิน → สิ้นสุดรอบ และจองซ้อน/ยกเลิก/no-show รวมถึงอีเมลจริง
5. ตรวจ scheduler รอบล่าสุด และคิวส่งล้มเหลวในหน้าผู้ดูแล
6. ตรวจ backup/restore และทดสอบ load ด้วยข้อมูลตัวแทนใน Preview ก่อนเพิ่มปริมาณใช้งาน

การ build และการตรวจในเครื่องไม่ยืนยัน routing/native dependencies/cron บน Vercel จนกว่าจะมี Preview จริง การ Deploy ยังรอคำสั่งจากผู้ใช้

อ้างอิง [Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [Express บน Vercel](https://vercel.com/docs/frameworks/backend/express), [vercel.json](https://vercel.com/docs/project-configuration/vercel-json) และ [Request headers](https://vercel.com/docs/headers/request-headers)
