# ผลแก้ Audit ทั้งหมด — 10 ตุลาคม 2569

ดำเนินการตามคำสั่งให้แก้ทั้งหมดโดยไม่ถามต่อ เทียบกับ [Audit เดิม](../../docs/AUDIT_2026-10-09.md), Request และ DOCS เก็บข้อกำหนดที่ขัดกันเป็น [baseline/decision log ปัจจุบัน](CURRENT_ARCHITECTURE.md) แทนการย้อนกลับไปใช้แบบ Oracle หรือ IoT

## สถานะส่งมอบ

| Audit | ผล |
| --- | --- |
| F01 บริการภายนอก | ยังไม่พร้อมเปิดจริง: direct Supabase IPv6 เชื่อมจากเครื่องไม่ได้; Google/SMTP/HTTPS ยังไม่มีค่าจริง ดูข้อจำกัดด้านล่าง |
| F02 ยกเลิกช้า | บันทึก LATE_CANCEL/audit ก่อนปฏิเสธเพียงครั้งเดียว คงสถานะ/ยอดอุปกรณ์ และ replay ข้อผิดพลาดเดิม |
| F03 ความจุ | ห้ามลดจนกระทบการจองที่ยังมีผล และตรวจความจุล่าสุดก่อนอนุมัติ |
| F04 วันหยุด | ADMIN CRUD พร้อม validation/ป้องกัน booking conflict ใช้กับค้นหา/จอง/อนุมัติ |
| F05 SLA | Deadline 4 ชั่วโมง เตือนก่อน 30 นาทีและ escalation เมื่อครบ แจ้งเฉพาะผู้รับผิดชอบ/ADMIN ครั้งเดียว |
| F06 สถานที่ | inactive ห้อง/อาคาร, delete เมื่อไม่มีความสัมพันธ์, คงประวัติ, ป้องกันลดชั้นกระทบห้อง และค้นหาตามชั้น |
| F07 รูปและตรวจ | HTTPS photo URL พร้อม fallback; inventory รายชิ้น; inspection snapshot/จำนวนชำรุดและห้องที่ยังไม่ตรวจวันนี้ |
| F08 ผู้ร่วมใช้ | อีเมลกรอกเองบน server ตรวจรูปแบบ/ซ้ำ/จำนวน พร้อม scope privacy; ไม่มี public user directory หรือ invitation อัตโนมัติ |
| F09 รายงาน | ช่วงปัจจุบัน, ชั่วโมงไม่เกิน now/end, utilization จากเวลาทำการหักวันหยุด/ปิดห้อง, inspection ณ วันที่รายงาน และ CSV อุปกรณ์ที่ป้องกัน formula injection |
| F10 อีเมล | เพิ่มรหัสการจอง ห้อง วัน/เวลาเดิม และเหตุผลยกเลิกในข้อความ; outbox/retry เดิมยังใช้งาน ส่งเข้ากล่องจริงรอ F01 |
| F11 Help | FAQ/contact ตั้งค่าได้ ค้นสถานะเฉพาะ booking ของตน ส่งคำถามให้ ADMIN และเก็บประวัติ |
| F12 เว็บจาก backend | static ก่อน Nest fallback; default path ไม่ขึ้นกับ cwd; หน้าเว็บและ API ใช้ origin เดียวผ่าน HTTP/Docker |
| D01–D04 | หมดอายุ PENDING เมื่อถึงเริ่มโดยไม่ลงโทษ; จ่าย/คืนของจริงและยอดค้างคืน; ประวัติ 7 วัน/ทั้งหมดและ archive 30 วันไม่ลบ; hours/lead ต่อห้องและ dated assignments |
| D05 | มี OpenAPI, worker heartbeat/queue status, Docker smoke, 50 concurrent reads, SQLite backup/restore และ runbook; production load/restore และหลาย instances ยังไม่รับรอง |

ความผิดของผู้จองนับทุกบทบาท การลงโทษยังต้อง ADMIN พิจารณา ไม่มีระงับอัตโนมัติ public catalog ค้นหาได้ก่อน login แต่ต้อง login ก่อนจอง ไม่ส่งบัญชีหรือข้อมูลส่วนตัว การเลือกห้องแล้วเข้าสู่ระบบกลับหน้าค้นหาได้

## หลักฐานที่ตรวจผ่าน

| การตรวจ | ผลและขอบเขต |
| --- | --- |
| `npm.cmd test` | 23/23 กฎธุรกิจ รวม SLA boundaries/dedupe, pending expiry, outstanding/partial equipment returns, inactive/delete, inventory snapshots, emails/privacy, Help, สูตรรายงาน, hours/dated scope และ archive |
| `npm.cmd run test:backend` | 31/31 รวม HTTP/session/CSRF/roles/idempotency, static/assets, public/privacy, validation, lifecycle/outbox, settings, operations, handover, concurrent booking, 50 concurrent reads และ SQLite backup/restore |
| PostgreSQL | PGlite ทดสอบ adapter/persistence/constraints/migrations ทั้ง 3 ไฟล์และ RLS ของ 23 ตาราง |
| `npm.cmd run build` | TypeScript frontend/backend และ production web assets ผ่าน; ตรวจ web build ซ้ำหลังแก้ public login navigation |
| `npm.cmd audit --omit=dev` | 0 vulnerabilities |
| Docker | สร้าง `kku-space:audit` รุ่นสุดท้ายผ่าน เปิด container ด้วยฐาน SQLite แยก; `/`, `/api/health/ready`, `/api/public/catalog`, `/api/openapi.json` ตอบ 200 และ worker บันทึก heartbeat |
| Browser workflow | ADMIN แก้ inventory/hours, ตรวจห้อง, บันทึก FAQ/contact แล้ว reload, export CSV; ผู้จอง mobile ส่ง participant email, ADMIN อนุมัติ, เจ้าของเปิดรายละเอียดเห็นอีเมล |
| Browser surfaces | Chromium desktop 1440×1000 และ mobile 390×844: ค้นหาก่อน login → เลือกห้อง → login; จัดการห้อง/รายงาน/Help/อาคาร/อุปกรณ์ ไม่มี page error หรือ horizontal overflow ทั้งหน้า |
| Cloud migration | ติดตั้ง `20261009171230_audit_settings.sql` ผ่าน Supabase MCP ใน KKU Space; project ACTIVE_HEALTHY, settings RLS เปิด, browser roles ไม่มีสิทธิ์, kku_server มีสิทธิ์ |

การตรวจ browser และ Docker ใช้ข้อมูลสมมติใน SQLite แยกจาก cloud ไม่สร้างบัญชี/การจองทดสอบใน production ไม่มีการส่งอีเมลจริง ภาพตรวจใช้ viewports ที่ตั้งก่อน login เพื่อไม่ให้ sidebar transition ทำให้ภาพ mobile คลาดเคลื่อน ตารางกว้างมีพื้นที่เลื่อนของตัวเอง

ภาพและ CSV อยู่ที่ [โฟลเดอร์หลักฐาน](verification/audit-2026-10-10/): [รายงานมือถือ](verification/audit-2026-10-10/audit-reports-mobile.png), [จัดการห้องคอมพิวเตอร์](verification/audit-2026-10-10/audit-manage-rooms-desktop.png), [ค้นหาก่อน login มือถือ](verification/audit-2026-10-10/audit-public-mobile.png), [Help มือถือ](verification/audit-2026-10-10/audit-help-mobile.png), [CSV อุปกรณ์](verification/audit-2026-10-10/audit-assets.csv)

## สิ่งที่ต้องตั้งค่าก่อนเปิดจริง

1. รับ Session pooler connection string จากหน้า Connect ของ Supabase project จริง: direct hostname lookup ใน system DNS ได้ ENOTFOUND; public DNS คืน AAAA แต่ TCP IPv6 จากเครื่องได้ ENETUNREACH จึงยังไม่ใช่หลักฐานว่าฐานข้อมูลหรือรหัสผ่านเสีย ใช้ runtime role/TLS ที่ตรวจ certificate ต่อไป
2. ตั้ง Google OAuth client credentials, SMTP/MAIL_FROM และ public HTTPS APP_ORIGIN ผ่านค่าลับของบริการ พร้อมผู้ดูแลคนแรกและข้อมูลห้องจริง แล้วตรวจ login/verification/booking/status/email ถึงผู้รับจริง
3. เปิด pilot หนึ่ง API instance/worker ก่อน กำหนดปริมาณใช้งานเป้าหมายและทำ production-like load test/restore drill บนฐานแยกตาม [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) การอ่าน state ทั้งชุด, writer lock รวม และ rate limiter ใน memory ยังไม่เหมาะกับการอ้างว่ารองรับหลาย instances หรือทั้งมหาวิทยาลัยแล้ว

Remote migration history เดิมใช้ timestamps ต่างจากไฟล์ local ต้องเทียบ history ก่อน db push การเพิ่ม settings เป็น migration additive ที่ตรวจสิทธิ์แล้ว ไม่มีการทับฐาน production หรือปรับเครือข่ายทั้งเครื่อง
