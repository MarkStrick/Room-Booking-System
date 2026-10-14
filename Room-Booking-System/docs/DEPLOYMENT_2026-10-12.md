# Deployment — 12 ตุลาคม 2569

อัปเดตล่าสุด: Term Project release `dpl_8DgU2UttNsLnrCeU5ZYQnMsMudaN` ถูก promote แล้ว เพิ่มฐานสัมพันธ์และ scheduler Supabase ทุกนาที ดู [ผลล่าสุด](TERM_PROJECT_COMPLIANCE.md) รายละเอียด deployment ID/cron ด้านล่างเป็น release ก่อนหน้า

- เว็บ: https://kku-room-booking-markstrick.vercel.app
- Vercel project: `kku-room-booking-markstrick`
- Team: `markstricks-projects` (Hobby)
- Project ID: `prj_plAaLpLBihor96shjDLSnHJXT9J2`
- Deployment ID: `dpl_tm1585YWrNVWPxdAVz4sR7hMLrpo`
- Deployment source: ไฟล์จาก working directory ปัจจุบัน ยังไม่มี Git commit ใน repository จึงไม่มี commit SHA ของ release นี้
- Runtime: Node.js 24, API function region `sin1`
- ใช้ฐานข้อมูล PostgreSQL เดิม ไม่สร้างข้อมูลใหม่ระหว่าง deploy มี 25 ห้อง (อ้างอิงสถานที่จริง 4, ข้อมูลจำลอง 21) และ ADMIN ที่ผู้ใช้กำหนด

## สิ่งที่ตรวจแล้ว

- Build ในเครื่องและ build บน Vercel ผ่าน สถานะ deployment READY
- Compiled serverless handler smoke test ผ่าน
- Backend tests ผ่าน 50 รายการ
- Runtime dependencies: `npm audit --omit=dev` พบช่องโหว่ 0 รายการ ณ รอบตรวจนี้
- ตรวจชุดไฟล์ 131 ไฟล์ก่อน upload: ไม่มี `.env`, PEM certificate, SQLite, `.vercel` credentials หรือ tmp
- Production environment มี DATABASE_URL/CA, Google client configuration, APP_ORIGIN และ CRON_SECRET/RATE_LIMIT_SECRET โดยค่าลับตั้งเป็น Secret ไม่พิมพ์ค่าออกมา
- HTTPS แบบไม่ใช้ protection bypass: `/`, `/api/config`, `/api/public/catalog`, `/room-images/meeting-illustrative.png` ตอบ 200
- ตรวจ protected staging ผ่าน `vercel curl` ก่อนเปิดโดเมนจริง: Google readiness true, email readiness false, public catalog 25 ห้อง/3 พื้นที่
- ไม่ลด deployment protection ของ Vercel; ใช้ public production domain ตามปกติ

## ขอบเขตงานตามเวลา

Hobby รองรับ cron วันละครั้ง จึงตั้ง `0 0 * * *` แทนทุกนาที ดู https://vercel.com/docs/cron-jobs/usage-and-pricing

API public catalog/session/state ประมวลผล lifecycle ตามเวลาจริงใน transaction เมื่อมีการเปิดหรือรีเฟรชเว็บ เพื่อให้คำขอหมดเวลาและ no-show เปลี่ยนสถานะก่อนแสดงห้องว่าง การทำงานขณะไม่มีคนเปิดเว็บยังขึ้นกับ cron วันละครั้ง หากต้องการตัดสถานะแม่นยำทุกนาทีแม้ไม่มีผู้ใช้ ต้องตั้ง scheduler เพิ่มหรือใช้แผนที่รองรับ

SMTP ยังไม่ได้ตั้งค่า ระบบให้ค้นหา/จองใช้งานได้และเก็บการแจ้งเตือนใน outbox ปุ่มส่งด้วยตนเองยังตรวจ mail readiness ตามเดิม ไม่อ้างว่าได้ส่งอีเมลจริง

## Google Login ที่ต้องตรวจต่อใน Google Cloud

OAuth client เดิมต้องอนุญาต Authorized redirect URI นี้:

```text
https://kku-room-booking-markstrick.vercel.app/api/auth/google/callback
```

หากกำหนด Authorized JavaScript origins ให้ใช้ `https://kku-room-booking-markstrick.vercel.app`

ไม่ได้แก้ OAuth client ใน Google Cloud และยังไม่ได้ยืนยัน login/callback จริง เครื่องมือ browser ถูกปฏิเสธสิทธิ์เปิดเว็บออนไลน์ จึงยืนยันได้เฉพาะ HTTP/API/assets ไม่ใช่การทดสอบ UI/OAuth แบบครบวงจร

Vercel connector ปฏิเสธ team mutation จึงใช้ CLI ที่ล็อกอินอยู่กับทีม/โปรเจกต์เดียวกันตาม fallback ที่เครื่องมือระบุ โดเมนถูก assign สำเร็จ การเรียก promote หลัง assign รายงานว่า deployment นี้เป็น production ปัจจุบันอยู่แล้ว
