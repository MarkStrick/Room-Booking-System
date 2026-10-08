# ข้อเสนอปรับฐานข้อมูลระบบจองห้อง

วันที่ตรวจ 8 ตุลาคม 2569

## 1 ผลการตรวจและขอบเขต

**ใช้ SAfordata.ddl เป็นฐานโครงสร้างได้ แต่ต้องทบทวน SAfordata_claude.sql และตัวอย่าง transaction ในรายงานให้เป็นแนวทางเดียวกันก่อนนำไปใช้งาน** เอกสารนี้ตรวจจากไฟล์และแผนภาพ ยังไม่ได้เชื่อม Oracle หรือรันทดสอบ SQL จึงเป็นรายการออกแบบและจุดตรวจสำหรับขั้นพัฒนา ไม่ใช่ผลรับรองการทำงานของ trigger

อ่านร่วมกับ [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) ซึ่งกำหนดโมดูล สิทธิ์ วงจรสถานะ และกติกาที่เสนอให้ทีมยืนยัน

## 2 สิ่งที่ฐานเดิมรองรับแล้ว

DDL มี 18 ตาราง: affiliation, users, staff, building, floor, room_type, room, room_assignment, equipment, room_equipment, booking, booking_participant, booking_equipment, booking_log, notification, penalty, holiday และ report

มี PK/FK ของความสัมพันธ์หลัก มี CHECK สำหรับ end_time > start_time และจำนวนอุปกรณ์มากกว่า/ไม่น้อยกว่าศูนย์ตามตาราง มี index สำหรับค้นหาการจองตามห้องและประวัติผู้ใช้ มี soft delete บางตาราง และแยกข้อมูลการจองออกจากสมาชิก/อุปกรณ์แล้ว

สคริปต์แก้เสนอเพิ่ม sequence/default สำหรับ ID, NO_SHOW, CHECK สถานะ, email unique แบบไม่สนตัวพิมพ์, index ของ FK, stock trigger และ compound trigger ตรวจช่วงซ้อน ประโยชน์เหล่านี้ควรรักษาไว้ แต่ต้องทำให้ตรงกับกฎจริง ไม่ใช้ค่าที่สคริปต์ระบุว่าเป็นข้อสมมติเป็นข้อกำหนดโดยปริยาย

## 3 จุดที่ต้องแก้ก่อนพัฒนา

| ประเด็น | หลักฐานจากไฟล์ | ผลกระทบและการแก้ที่เสนอ |
| --- | --- | --- |
| หักสต็อกซ้ำ | รายงาน PDF มี UPDATE remaining_qty หลัง INSERT booking_equipment; SQL แก้มี trg_be_stock ทำงานจาก INSERT เดียวกัน | เลือกเจ้าของการปรับ stock เพียงชุดเดียว ห้ามคัดลอก transaction ตัวอย่างมาใช้พร้อม trigger โดยไม่แก้ |
| สต็อกข้ามวัน | trigger หักจำนวนทันทีสำหรับทุก PENDING/APPROVED/CHECKED_IN | คนจองวันอื่นใช้โควตาเดียวกัน ต้องยืนยันว่าใช้ conservative reservation หรือเปลี่ยนเป็นตามช่วงเวลา |
| คืนของก่อนของกลับจริง | trg_booking_release_stock คืนเมื่อ COMPLETED และสถานะปิดอื่นโดยไม่ตรวจการจ่าย/คืนจริง | เพิ่ม loan state และ movement; คืนเฉพาะ reservation ที่ยังไม่จ่ายหรือของที่ยืนยันคืนแล้ว |
| เปลี่ยน FK รายการยืม | trg_be_stock เฝ้า INSERT/DELETE/UPDATE OF borrowed_qty แต่ไม่เฝ้าเปลี่ยน equipment_equipment_id หรือ booking_booking_id | ห้ามแก้ identity ของรายการยืม หรือทำ delete/insert ภายใต้ service เดียวกับ stock movement |
| เปิดสถานะปิดกลับเป็น active | trigger release คืนเมื่อ active → terminal แต่ไม่มี reserve ใหม่เมื่อ terminal → active | ห้ามเปิดกลับผ่าน API และเสริม state transition ที่ DB; จองใหม่เป็นรายการใหม่ |
| WARNING ทำให้จองไม่ได้ | trg_booking_rules ตรวจ penalty_status=ACTIVE แต่ไม่ได้กรอง penalty_type | ตรวจเฉพาะ SUSPENSION ที่มีผล; warning เป็นหลักฐานตัดสินและ reset count ไม่ใช่การระงับ |
| จุดตรวจ penalty ไม่ครบตาม Scenario | trigger ตรวจตอน INSERT หรือเปลี่ยนวันที่/ผู้จอง ไม่ได้เป็น authorization ทุก command | service ตรวจตอนจองและเช็คอิน รวม account/session และตกลงผลต่อ booking เดิม |
| เจ้าหน้าที่ผิดช่วงมอบหมาย | trigger ตรวจว่ามีคู่ staff/room แต่ไม่ตรวจ start_date, ช่วงสิ้นสุดหรือ staff_status | เพิ่ม assignment end/status และตรวจตามเวลาพิจารณา; work_shift ต้องนิยามหรือไม่ใช้เป็นกฎ |
| admin override ถูกบล็อก | trigger กำหนดว่าผู้อนุมัติ/ปฏิเสธต้องมี room_assignment ไม่แยก ADMIN | หากเลือกสิทธิ์ admin ทุกห้องตามแบบ ให้ปรับกฎ DB และบันทึก actor/reason ให้สอดคล้องกัน |
| ไม่มีข้อมูลปิดห้องเป็นช่วง | room มีเพียง room_status; ไม่มี start/end/reason การปิด | เพิ่ม room_closure และตรวจทุก command ที่เกี่ยวกับห้อง ไม่ใช้ status ทับช่วงอนาคต |
| ผู้เข้าร่วมและความจุ | ฟอร์มมี expected attendees แต่ booking ไม่มีคอลัมน์ดังกล่าว; room.capacity อนุญาต NULL | เพิ่ม expected_attendees > 0 และ room.capacity > 0 NOT NULL; service ตรวจไม่เกินความจุ |
| quota PENDING 3 รายการ | ไม่มี lock/check ที่คุมข้ามห้องของผู้ใช้คนเดียวใน SQL แก้ | ล็อก users ก่อนนับและสร้าง booking ทุกทางเข้า รวม API/job และ integration ที่อาจเพิ่มข้อมูล |
| กฎเวลายังไม่ครบ | DDL ตรวจ end > start เท่านั้น ไม่บังคับ 30 นาที–4 ชั่วโมง/15 วัน/2 ชั่วโมง | duration ใช้ DB CHECK ได้; กฎที่อิงเวลาปัจจุบันใช้ BookingPolicy และตรวจใน transaction |
| ระบบบันทึก log ไม่มี user มนุษย์ | SQL แก้ให้ booking_log.users_user_id NOT NULL แต่ no-show/complete เกิดจาก worker | แยก actor_type และ actor_user_id nullable สำหรับ SYSTEM พร้อม affected_user_id/booking owner; ไม่ใส่ชื่อผู้จองเป็นคนที่กดคำสั่งระบบ |
| การนับผิดเงื่อนไขปน actor | booking_log ผู้บันทึกอาจเป็นเจ้าหน้าที่แต่ความผิดเป็นของผู้จอง | เพิ่ม violation ที่มี affected_user_id และ unique source key; นับจากหลักฐานนี้ |
| ไม่มีจุดเริ่มนับหลังตัดสิน | penalty ไม่มี decided_at/count_from_at | เพิ่มเวลาตัดสินและจุดเริ่มนับ ให้ warning และ suspension เริ่มรอบใหม่ตาม Scenario โดยไม่ลบ log |
| คิวอีเมลไม่มีสถานะส่ง | notification มี send_time แต่ไม่มี delivery_status/attempt/lease | เพิ่ม outbox fields แยก created/sent/delivered ถ้ามี receipt; retry หลัง commit |
| noti_type ต่างกัน | ตัวอย่าง PDF ใส่ EMAIL แต่ CHECK ใหม่ใช้ BOOKING_APPROVED ฯลฯ | ใช้ channel=EMAIL และ noti_type เป็นประเภทเหตุการณ์; ปรับตัวอย่างและ API ให้ตรง |
| ชนิด violation_flag ต่างกัน | DDL/รายงานใช้ YES/NO แต่ patch เปลี่ยนเป็น NUMBER(1) | บังคับเวอร์ชัน schema เดียว และแปลง DTO กับ repository หลัง migration |
| report FK เปลี่ยนชื่อ | patch เปลี่ยน user_userid เป็น users_user_id | ใช้ชื่อใหม่ใน repository/seed/report query ทั้งหมดและมี migration ledger |
| updated_at ไม่อัปเดตเอง | DEFAULT current_timestamp มีผลตอน INSERT; ไม่ใช่ทุก UPDATE | กำหนด updated_at ใน service ทุกคำสั่งหรือใช้ trigger ที่มีหน้าที่เฉพาะนี้ |
| CHECK และ NULL | หลายคอลัมน์มี CHECK แต่ยัง nullable; patch เพิ่ม CHECK is_deleted บางตารางแต่ไม่ NOT NULL ทุกตาราง | CHECK ไม่แทน NOT NULL; normalize ค่าเดิมแล้วตั้ง NOT NULL/default ตามความหมาย |
| ข้อมูลเดิมไม่ผ่าน CHECK | หลาย CHECK ใน patch ใช้ ENABLE NOVALIDATE | inventory ข้อมูลเดิมและแก้ก่อน ENABLE VALIDATE; การเพิ่ม constraint สำเร็จไม่แปลว่าข้อมูลเดิมสะอาดแล้ว |
| โครงสถานที่ยังไม่บังคับ | room.floor_floor_id/room_type FK nullable และไม่ unique ชื่อห้องในชั้น | เพิ่ม NOT NULL และ business unique keys หลังตรวจข้อมูลซ้ำ |
| ไม่มีข้อมูล FAQ/inspection/login | พบ requirement แต่ไม่พบ entity ที่รองรับใน DDL | เพิ่มตารางตามหัวข้อ 13 ในแบบระบบ ไม่เก็บ chat/ผลตรวจใน log ข้อความอิสระแทนทั้งหมด |

## 4 เจ้าของกฎธุรกิจและการเขียนข้อมูล

แนะนำให้ API และ worker ใช้ service เดียวกันสำหรับสร้าง/เปลี่ยน booking และใช้ transaction เดียวในการเขียน booking, stock movement, audit, violation และ notification กติกาที่มีหลายตารางตรวจใน service หรือ package ที่ออกแบบเป็นจุดเขียนเดียว ส่วน DB รับผิดชอบ PK/FK/NOT NULL/CHECK/UNIQUE และการล็อกที่รับประกันข้อมูลพร้อมกัน

หากเลือกใช้ PL/SQL package สำหรับ booking command ให้ backend เรียก package นั้น และ package ไม่ commit เอง เพื่อให้ backend รวม outbox/log ใน transaction ได้ ไม่ใช่เพิ่มกฎใน service, package และ trigger สามชุดที่หัก stock พร้อมกัน

compound trigger ป้องกัน overlap อาจคงไว้เป็นการตรวจเสริมได้ แต่ต้องทดสอบกับ Oracle จริงให้ตรงกับรูปแบบ command, isolation และลำดับ lock การมี trigger ในไฟล์ไม่ใช่หลักฐานว่ากรณี concurrent sessions ทุกแบบผ่านแล้ว

ทุกคำสั่งที่เขียนทรัพยากรที่ใช้ร่วมกันต้องใช้ลำดับ lock เดียวกันตามแบบหลัก การแก้ห้องของ booking ให้เป็น cancellation + booking ใหม่ในรุ่นแรก เพื่อลดกรณีล็อก old/new room และการจัดสรรอุปกรณ์ที่ย้อนแย้ง

## 5 หลักการออกแบบ stock

สำหรับรุ่นแรกที่เลือก conservative reservation กำหนดจำนวนแต่ละประเภทให้ชัด:

- `total_qty` คือจำนวนในกองที่ให้ยืมได้ ไม่รวมอุปกรณ์ประจำห้องและของที่ชำรุดจนยืมไม่ได้
- `remaining_qty` คือจำนวนที่ยังไม่ถูกกันหรือจ่ายค้างตามกติกานี้ ไม่ใช่จำนวนทั้งหมดที่มองเห็นในห้องเก็บของ
- `booking_equipment` ระบุจำนวนและสถานะ RESERVED, ISSUED, RETURNED หรือ RELEASED พร้อมจำนวนคืนแล้ว
- `stock_movement` บันทึกการกัน ปล่อย จ่าย คืน และปรับยอด พร้อม source_event_key ที่ unique เพื่อทำซ้ำไม่ได้

RESERVED → ISSUED ไม่หัก remaining_qty อีกรอบ เพราะหักตอนกันแล้ว RESERVED → RELEASED คืนได้หนึ่งครั้ง ส่วน ISSUED → RETURNED คืนเท่าจำนวนที่บันทึกคืนจริง COMPLETED ไม่คืนยอดของ ISSUED โดยอัตโนมัติ

หากเปลี่ยนไปใช้ reservation ตามช่วงเวลา ให้แยก available physical stock ออกจาก scheduled capacity และคำนวณยอดที่ถูกกันพร้อมกันในแต่ละช่วงย่อยของเวลาที่ขอ การรวมยอดทุก booking ที่แตะช่วงเวลาคำขออย่างเดียวอาจปฏิเสธเกินจริง เพราะ booking เหล่านั้นอาจไม่ใช้งานพร้อมกันทั้งหมด

ตอนย้ายข้อมูล ห้ามตั้ง total_qty=remaining_qty โดยถือว่าถูกเสมอ ต้องตรวจของที่ถูกกัน/จ่ายค้างและของจริงก่อน สคริปต์ต้นทางเตือนข้อสมมตินี้ไว้แล้ว การปิดรอบ booking ไม่ใช่หลักฐานว่าของกลับครบ

## 6 migration ที่เสนอ

ลำดับนี้เป็นแผน ยังไม่ได้สร้างหรือรัน migration

| ลำดับ | งาน | เงื่อนไขก่อนผ่าน |
| --- | --- | --- |
| 001 | สร้าง baseline จาก SAfordata.ddl และ migration ledger | schema ใหม่มีครบ 18 ตารางและ FK/sequence ตามตรวจนับจริง |
| 002 | แก้ข้อมูลเดิม เติม ID/default, NOT NULL, CHECK, unique/index | ไม่มี email ซ้ำ ชื่อห้องซ้ำ สถานะนอกชุด null สำคัญ และช่วงเวลาผิด |
| 003 | เพิ่ม identity/session และแยก person type/role | บัญชี staff/admin มาจากผู้ดูแล; Google subject unique แม้ email เปลี่ยน |
| 004 | เพิ่ม booking metadata และกติกาสถานะ | expected attendees, deadline, cancel reason และ version พร้อม data backfill |
| 005 | เพิ่ม room_closure, assignment end/status และ inspection | ค้นหา/จอง/ปิดห้องใช้ช่วงเวลาเดียวกัน |
| 006 | เลือกและปรับ stock mechanism | ไม่มี trigger และ service หักคืนซ้ำ; reconcile กองอุปกรณ์แล้ว |
| 007 | เพิ่ม violation, penalty decision fields และ system audit | dedupe เหตุการณ์ได้และ warning ไม่บล็อก booking |
| 008 | เพิ่ม notification outbox, job lease และ idempotency | claim/retry/restart ได้และ send_time ไม่แสดงว่า SENT ก่อนส่ง |
| 009 | เพิ่ม FAQ/chat และ report scope/definition | history ownership และสูตรรายงานทดสอบได้ |
| 010 | ตรวจข้อมูลและ validate constraints | object VALID, ไม่มี compile error และ concurrent flow ผ่าน |

Oracle DDL อาจ commit โดยปริยาย จึงไม่ใช้ ROLLBACK ของ transaction แอปเป็นแผนย้อน migration ต้องสำรองข้อมูล มี forward repair/backfill ที่ทดสอบแล้ว และรันใน dev/test ก่อนเปลี่ยน schema ใช้ migration ledger หลีกเลี่ยงรัน ALTER/DROP เดิมซ้ำทั้งไฟล์ [Oracle driver transaction documentation](https://node-oracledb.readthedocs.io/en/stable/user_guide/txn_management.html)

สคริปต์ต้นทางบางช่วง เช่นสร้าง sequence ระบุว่ารันซ้ำได้ แต่ทั้งไฟล์มี ADD/DROP/RENAME constraint/column/index ซึ่งไม่ได้รันซ้ำได้ทั้งหมด การ DROP sequence แล้วสร้างจาก MAX(id)+1 ต้องหยุดการเขียนและตรวจ dependency ในขั้น migration ไม่ทำระหว่างมี traffic

## 7 รายการตรวจยืนยันกับฐานจริง

1. เก็บเวอร์ชัน Oracle, charset, database/session timezone และ driver mode ที่ใช้จริง ทดสอบข้อความภาษาไทยและ ISO timestamp ไปกลับ
2. สร้าง schema ว่างจาก migration ลำดับเดียวกันกับที่ทีมจะใช้จริง และตรวจตาราง/constraint/index/sequence เทียบแบบ ไม่ใช้ summary comment ท้าย DDL เป็นหลักฐานแทน metadata
3. ตรวจ user_objects และ user_errors ให้ทุก object ที่ต้องใช้ VALID; ตรวจ constraint status/validated และ FK index ตาม query จริง
4. ใช้ connection แยกกันอย่างน้อยสอง session ทดสอบจองซ้อน quota ต่อคน stock ชิ้นสุดท้าย approve/cancel และ check-in/no-show โดยวางจังหวะก่อน/หลัง lock และ commit
5. ทดสอบ fault หลังเขียน booking/stock/log/outbox แต่ก่อน commit ว่าข้อมูลย้อนกลับครบ ไม่ส่งอีเมลจาก transaction ที่ rollback
6. ทดสอบการเปลี่ยนสถานะที่ไม่อนุญาต การกดซ้ำ คำขอซ้ำ และ worker ซ้ำ ไม่คืน stock หรือเพิ่ม violation ซ้ำ
7. ตรวจ STAFF scope, assignment dates, admin override, warning/suspension และบทลงโทษที่เกิดหลังการจอง
8. ตรวจผลค้นหาในช่วงปิดห้อง วันหยุดและขอบเวลา โดยเวลาที่ API/DB/job ตัดสินตรงกัน
9. ตรวจยอดอุปกรณ์กับ movement และของค้าง ตรวจจำนวนรายงานจาก dataset ที่ทราบคำตอบล่วงหน้า
10. ทดลอง restore สำเนาฐานและไฟล์โดยไม่ใช้ข้อมูลจริงในชุดทดสอบ

## 8 เอกสารอ้างอิง

- [SAfordata.ddl](../Request/SAfordata.ddl) เป็น baseline ตารางและ constraint
- [SAfordata_claude.sql](../Request/SAfordata_claude.sql) เป็นข้อเสนอ ALTER และ trigger ที่ต้องปรับให้ตรงนโยบาย
- [Term Project_เบส_888.pdf](../Request/Term%20Project_เบส_888.pdf) มี transaction ตัวอย่างในหน้า 15–21 ที่ต้องปรับเมื่อใช้ schema/stock เวอร์ชันใหม่
- [ปรับปรุงแก้ไขdatabase.pdf](../Request/ปรับปรุงแก้ไขdatabase.pdf) เป็นบริบทเหตุผลการแก้ฐานข้อมูล
- [ASS02-02-Draft.docx](../Request/ASS02-02-Draft.docx) มี Scenario ผู้เข้าร่วม ยืมอุปกรณ์ การปิดห้อง FAQ เช็คอินและการเริ่มนับความผิดหลังตัดสิน

เอกสารอ้างอิงเป็นแหล่งความต้องการและตัวอย่าง ไม่ใช่คำสั่งให้รัน SQL กับฐานที่ใช้งานจริงทันที
