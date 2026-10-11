# Google Login สำหรับบัญชีมหาวิทยาลัย

นโยบายปัจจุบันอนุญาตเฉพาะ `@kkumail.com` และ `@kku.ac.th` ตรวจอีเมลที่ Google ยืนยันแล้วและโดเมนองค์กร (`hd`) จาก ID token ฝั่ง API ก่อนสร้างบัญชีหรือ session ไม่รับ Gmail, โดเมนย่อย หรือชื่อโดเมนที่ต่อท้ายคล้ายมหาวิทยาลัย

## Google Cloud

- โปรเจกต์: **KKU Room Booking** (`optimum-battery-511320-m5`)
- อีเมล support/contact: บัญชีที่ผู้ใช้ยืนยันใน Google Cloud
- OAuth Client: Web application ชื่อ **KKU Room Booking Local**
- Origins: `http://127.0.0.1:5173` และ `http://127.0.0.1:5174`
- Redirect URIs:
  - `http://127.0.0.1:5173/api/auth/google/callback`
  - `http://127.0.0.1:5174/api/auth/google/callback`
- Scopes ที่แอปขอ: `openid email profile` สำหรับเข้าสู่ระบบ ไม่มีสิทธิ์อ่าน Gmail หรือ Drive
- ปัจจุบันเป็น External / Testing แต่ใช้เฉพาะ basic identity scopes จึงอยู่ในข้อยกเว้นของ Google: ผู้ใช้ไม่ต้องอยู่ใน test-user list ดู [Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en) หากเพิ่ม scopes อื่น ต้องทบทวนนโยบาย Testing/verification ใหม่
- Publish app ยังไม่เปิดให้กด เนื่องจากยังไม่มี public homepage/privacy-policy URLs ระบบนี้เชื่อมเฉพาะเว็บในเครื่อง และไม่ได้อ้างว่าได้เผยแพร่เว็บไซต์หรือผ่าน Google brand verification แล้ว
- การเพิ่มเว็บไซต์จริงภายหลังต้องลงทะเบียน HTTPS callback ของเว็บไซต์นั้น และตั้ง `APP_ORIGIN` ให้ตรงกัน

## ค่าฝั่งเซิร์ฟเวอร์

ไฟล์ `.env` ถูกละเว้นจาก Git ค่าลับใช้เฉพาะเซิร์ฟเวอร์:

```dotenv
APP_ORIGIN=http://127.0.0.1:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_GOOGLE_DOMAINS=kkumail.com,kku.ac.th
ALLOW_PUBLIC_GOOGLE=0
```

Client ID และ Secret จาก Client ที่สร้างแล้วถูกบันทึกใน `.env` และเปิด API ใหม่แล้ว ตัวอย่างข้างบนเว้นค่าว่างเพื่อไม่เผยค่าลับ ไม่ตั้งค่าลับด้วยชื่อ `VITE_` และไม่วาง Secret ในแชตหรือภาพตรวจงาน

เปิดเว็บด้วย `npm.cmd run dev` และเปิด API ที่สร้างแล้วด้วย `npm.cmd start` อีก Terminal (`npm.cmd run build` เมื่อแก้โค้ด API) เข้าเว็บผ่าน `http://127.0.0.1:5173` ให้ตรงกับ origin หากเปลี่ยนเป็น preview พอร์ต 5174 ต้องเปลี่ยน `APP_ORIGIN` และเปิด API ใหม่ด้วย

ในเครื่องนี้เปลี่ยนฐานข้อมูลจาก direct endpoint ที่มีเฉพาะ IPv6 เป็น Session Pooler ตามค่าจาก Supabase Dashboard ใช้บัญชี `kku_server` เดิมและตรวจ TLS certificate ตามเดิม อ่านข้อมูลผ่านแล้ว ไม่มีการเปลี่ยน schema หรือสิทธิ์ฐานข้อมูล

## การตรวจ

- Build เว็บและ API ผ่าน
- Backend tests 45 รายการผ่าน รวมรับอีเมลทั้งสองโดเมนและปฏิเสธ Gmail/โดเมนปลอม/อีเมลไม่ยืนยัน/ไม่มี hosted domain
- บัญชีที่เคยเชื่อม Google เปลี่ยนเป็นอีเมลนอกโดเมนจะถูกปฏิเสธ โดยไม่เปลี่ยนข้อมูล identity
- API config ตอบ 200 พร้อม `googleReady:true` และ allowedDomains ทั้งสองโดเมน; database readiness ตอบ 200
- OAuth start ตอบ 302 ไป accounts.google.com พร้อม callback พอร์ต 5173 และ scopes `openid email profile`; ปุ่มหน้าเว็บเปิดหน้าเลือกบัญชี Google ที่ระบุ KKU Room Booking ได้จริง
- ยังต้องให้ผู้ใช้เข้าสู่ระบบบัญชีมหาวิทยาลัยจริง และตรวจว่าได้ session ก่อนถือว่าล็อกอินครบขั้นตอน

[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) และ [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres) เป็นเอกสารอ้างอิงการตั้งค่า
