# สถาปัตยกรรมและข้อกำหนดปัจจุบัน — 11 ตุลาคม 2569

อัปเดต Term Project 12 ต.ค. 2569: เพิ่ม schema `kku_booking` ครบ 18 entities, FK 26 จุด, deferred transaction projection, audit/soft delete และรายงาน snapshot ที่บันทึกจากเว็บได้ รองรับจองข้ามวันและเปิด Supabase scheduler ทุกนาทีแล้ว ดู [รายละเอียดและผลทดสอบ](TERM_PROJECT_COMPLIANCE.md) คำอธิบาย JSONB-only ด้านล่างเป็นสถานะก่อนเพิ่มตารางสัมพันธ์

อัปเดต 12 ต.ค. 2569: เพิ่มและติดตั้ง SQL hardening migration แล้ว `kku_server` ใช้ DML ผ่าน RLS policy โดยไม่เป็นเจ้าของตาราง เพิ่ม JSONB constraints, room/building FK, immutable booking identity/slot และ guard สถานะ ส่วน adapter ใช้ parameterized values และรายการชื่อตารางตายตัว ดู [SQL_SECURITY.md](SQL_SECURITY.md) ข้อความคง schema/no migration ด้านล่างอธิบายงานวันที่ 11 ต.ค. ก่อนการแก้ครั้งนี้

อัปเดต 11 ต.ค. 2569: client ใช้ ServerProvider เสมอ lazy-load AdminSandbox หลังตรวจ live ADMIN session ข้อมูลจำลองอยู่ใน memory ไม่ใช้ localStorage ไม่ออก session ให้ตัวอย่าง ปิด /auth/development ทุกโหมด และ startup ไม่สร้าง seed จาก DEV_LOGIN อีกต่อไป เพิ่ม readiness สำหรับ ADMIN, bootstrap ผู้ดูแลผ่าน operator CLI, API adapter สำหรับ Vercel และ bounded cron cycle ที่ป้องกันด้วย CRON_SECRET บน Vercel ใช้ auth rate counter ใน attempts ร่วมกันข้าม instances และรองรับ DATABASE_CA_PEM โดยยังตรวจ TLS certificate คง schema เดิม ไม่เพิ่ม migration ดู [Vercel](VERCEL_SETUP.md)

เอกสารนี้เป็น baseline ของโค้ดที่ส่งมอบหลัง Audit ส่วน SYSTEM_ARCHITECTURE และ DATABASE_REVIEW ในโฟลเดอร์ docs ระดับโครงการเป็นข้อเสนอเดิมสำหรับอ้างอิง ไม่ใช่คำอธิบาย deployment ปัจจุบัน

## ระบบที่ใช้จริงในโค้ด

React + TypeScript เรียก NestJS/Express ผ่าน session cookie และ CSRF; คำสั่งตรวจด้วย Zod และกฎธุรกิจใน packages/core ใช้ร่วมกับ demo เซิร์ฟเวอร์ใช้ PostgreSQL/Supabase private schema และ JSONB payload โดยมี booking exclusion constraint, transaction lock และ idempotency SQLite ใช้เฉพาะการทดสอบในเครื่อง

API ส่งหน้าเว็บที่ build แล้วก่อน Nest fallback; public/catalog ใช้ค้นหาก่อน login โดยไม่ส่งบัญชี เนื้อหาการจอง อีเมลผู้ร่วมใช้ หรือแจ้งเตือนส่วนตัว ต้อง login ก่อนส่งคำขอจอง ช่องทาง password/Google มีโค้ดครบ แต่การเปิดใช้ยังต้องมีค่าบริการจริง

ตาราง settings ใหม่เก็บ FAQ ช่องทางติดต่อ และ worker heartbeat เป็น singleton ตารางอื่นยังใช้เดิม รูปห้องเก็บ HTTPS URL ที่ผู้ดูแลตั้ง ไม่อัปโหลดไฟล์เข้าฐานข้อมูล รายการอุปกรณ์ประจำห้องอยู่ใน room inventory; inspection เก็บ snapshot ชื่อ จำนวน และจำนวนชำรุด ณ เวลาตรวจ

## นโยบายที่ใช้ในรอบแก้ทั้งหมด

ผู้ใช้สั่งให้ทำ Audit ที่เหลือทั้งหมดโดยไม่ถามต่อ วันที่ 10 ต.ค. 2569 จึงเลือกกฎต่อไปนี้และบันทึกไว้เป็นผลการตัดสินใจในการพัฒนา:

| ประเด็น | พฤติกรรมปัจจุบัน |
| --- | --- |
| SLA | Deadline = createdAt + 4 ชั่วโมง; แจ้งเจ้าหน้าที่ที่มีสิทธิ์และ ADMIN ก่อนครบ 30 นาที และเมื่อเกินกำหนด ครั้งเดียวต่อเหตุการณ์ ไม่ตัดสินแทนคน |
| PENDING หมดเวลา | ยกเลิกเมื่อถึงเวลาเริ่ม คืนยอดกันจอง ส่งเหตุผล ไม่เพิ่มความผิด; ไม่หมดอายุเพียงเพราะเกิน SLA |
| เลิกใช้งานพื้นที่ | ห้อง/อาคาร inactive ซ่อนจากค้นหา รักษาประวัติ; ห้ามเลิกใช้ถ้ามีการจองที่ยังมีผล ลบจริงเฉพาะไม่มีความสัมพันธ์ |
| ชั้น | ใช้จำนวนชั้นต่ออาคารและ floor ของห้องต่อไป; ห้ามลดจำนวนชั้นจนห้องเดิมอยู่นอกช่วง มีตัวกรองชั้นในการค้นหา |
| อุปกรณ์ | กันยอดตอนจอง จ่ายจริงหลังเช็คอิน เก็บ issued/returned แยกกัน เมื่อจบรอบคืนเฉพาะยอดที่ยังไม่จ่าย ชิ้นที่ค้างคืนยังถูกกันไว้ จ่าย/คืนผ่านผู้ดูแลห้องและมี audit |
| ผู้ร่วมใช้งาน | server รับอีเมลที่ผู้จองระบุเอง ไม่เปิด directory ผู้ใช้ทั้งหมด ไม่ส่ง invitation อัตโนมัติ; จำนวนรวมผู้จองและรายชื่อต้องไม่เกินจำนวนคน; ข้อมูลอ่านเฉพาะเจ้าของ/ผู้ดูแลที่มีสิทธิ์ |
| ประวัติ | ประวัติ 7 วันเรียง createdAt; มีแท็บทั้งหมด; terminal booking เกิน 30 วันมี archivedAt โดยไม่ลบ ไม่เปลี่ยนหลักฐานความผิดหรือรายงาน |
| เวลาทำการ | ผู้ดูแลเลือกวันเปิด เวลาเปิด/ปิด และ lead time ต่อห้อง; ไม่มีการบังคับเพิ่ม lead 4 ชั่วโมงให้ทุกห้อง ข้อมูลเดิมที่ยังไม่ตั้งเวลายังใช้กฎเดิม อัตราใช้ห้องแสดงไม่ทราบจนมีเวลาทำการ |
| การมอบหมาย | start/end ไม่บังคับ ตรวจวันที่ Bangkok ก่อนให้สิทธิ์ STAFF; ADMIN มีสิทธิ์ตามบทบาท |
| รายงาน | ช่วงเริ่มต้นเดือนปัจจุบันถึงวันนี้ จำกัดการคำนวณ 366 วัน/ครั้ง ชั่วโมงจากเช็คอินถึง min(now,end) อัตราใช้เทียบเวลาทำการที่ผ่านไป หักวันหยุดและ closure; เป็นค่าประมาณการออกห้อง ไม่ใช่ sensor |
| บทลงโทษ | ความผิดของผู้จองนับทุกบทบาท การพิจารณาโดย ADMIN เท่านั้น ไม่ระงับอัตโนมัติ |
| Help | ผู้ดูแลแก้ FAQ/contact ได้ ถามสถานะจากรหัสการจองของตนเองได้ มีปุ่มส่งคำถามให้ผู้ดูแลในระบบ ไม่มี LLM |

## Use Case canonical mapping

ใช้เลขจาก ASS-01-02-doc.docx: UC1 ยกเลิก, UC2 เข้าสู่ระบบ, UC3 ข้อมูลบัญชี, UC4 ค้นห้อง, UC5 จอง, UC6 ประวัติ, UC7 ช่วยเหลือ, UC8 พิจารณา, UC9 ห้อง/อุปกรณ์/ตรวจ, UC10 อาคาร/ชั้น, UC11 แจ้งสถานะ, UC12 รายงาน, UC13 อีเมลยกเลิก, UC14 ปิดห้อง, UC15 เช็คอิน/no-show, UC16 บทลงโทษ ไม่ใช้เลขจาก diagram ที่อ้างไม่ตรงกันเป็นชื่อ API

BR10 เข้าสู่ระบบด้วย Google เท่านั้น รับเฉพาะอีเมล @kkumail.com และ @kku.ac.th ที่ Google ยืนยันแล้ว พร้อมตรวจโดเมนองค์กรใน token ฝั่งเซิร์ฟเวอร์ IoT/ตัดไฟ/พลังงานอยู่นอกขอบเขต การลบประวัติถาวรไม่ได้เปิดอัตโนมัติ

## การปฏิบัติการและข้อจำกัด

API/worker ใช้ transaction lock ในฐานข้อมูลเพื่อความถูกต้อง บน Vercel ตัวจำกัดคำขอเข้าสู่ระบบใช้ counter ในฐานข้อมูลร่วมกันข้าม instances; ตัวจำกัดคำขอ API ทั่วไปยังอยู่ในแต่ละ process งานตามเวลาใช้ cron ที่ตรวจ CRON_SECRET และทำงานเป็นรอบจำกัดเวลา บนโฮสต์ทั่วไปใช้ worker process เดิม Worker บันทึก heartbeat และ ADMIN ดูคิวรอส่ง/ล้มเหลวที่หน้าช่วยเหลือหรือ /api/admin/operations ห้ามถือว่า readiness DB ผ่านเท่ากับ worker/SMTP ทำงาน

การทดสอบ local ครอบคลุม 50 reads พร้อมกันและ SQLite backup/restore ข้อมูลตั้งค่า ส่วน PostgreSQL ทดสอบผ่าน PGlite และตรวจ migration/สิทธิ์ใน cloud ไม่ถือเป็น load/restore drill บน production ตามปริมาณเป้าหมาย

การตรวจการเชื่อมต่อแบบอ่านอย่างเดียววันที่ 11 ต.ค. ผ่าน Supabase PostgreSQL พร้อมตรวจ TLS certificate และพบ 23 ตารางที่เปิด RLS ปัญหา IPv6/ENETUNREACH ในบันทึกวันที่ 10 ต.ค. เป็นสถานะในอดีต ยังต้องตั้ง SMTP, public HTTPS origin, ผู้ดูแลคนแรก และข้อมูลห้องจริง Google OAuth เป็นทางเลือกและปุ่มจะซ่อนจนตั้งค่า ก่อนเปิดใช้ Vercel ต้องตรวจ environment, routing, cron, TLS และอีเมลบน deployment จริง รวมถึง load/restore drill ตามปริมาณเป้าหมาย ขณะนี้ยังไม่ Deploy ตามคำสั่งผู้ใช้
