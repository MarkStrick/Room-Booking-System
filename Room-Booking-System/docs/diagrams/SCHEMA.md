# ER Diagram และ Schema — KKU SPACE

ตรวจ PostgreSQL/Supabase จริงเมื่อ 2026-10-12 โดยอ่านเฉพาะ metadata ไม่อ่านข้อมูลผู้ใช้และไม่แก้ฐานข้อมูล

## ไฟล์และหน้า Draw.io

| หน้า | เนื้อหา | ภาพ |
| --- | --- | --- |
| 01 PostgreSQL - Physical schema | 23 tables | 51 columns | 4 enforced foreign keys | schema: kku_private | verified 2026-10-12 | [postgres-schema.png](postgres-schema.png) / [SVG](postgres-schema.svg) |
| 02 Business - Logical ER | Current application model | JSONB properties, not additional SQL columns | 2026-10-12 | [business-er.png](business-er.png) / [SVG](business-er.svg) |
| 03 Google auth - Runtime | Google OAuth -> identities -> users -> sessions | custom server auth | 2026-10-12 | [google-auth-er.png](google-auth-er.png) / [SVG](google-auth-er.svg) |
| 04 Oracle - Core ER | 18 original entities + revised columns | SQL source model; not verified on a live Oracle instance | [oracle-core-er.png](oracle-core-er.png) / [SVG](oracle-core-er.svg) |
| 05 Oracle - Extensions ER | 12 added tables | 30 total Oracle tables including migration journal | SQL source model only | [oracle-extensions-er.png](oracle-extensions-er.png) / [SVG](oracle-extensions-er.svg) |

เปิด [kku-space-er.drawio](kku-space-er.drawio) ใน https://app.diagrams.net แล้วเลือก File → Open From → Device แต่ละตาราง ฟิลด์ และเส้นเป็นวัตถุที่แก้ไขได้

PNG ความละเอียด 2 เท่าของพื้นที่วาด; SVG ซูม/พิมพ์ได้โดยไม่แตก และ ZIP รวมไฟล์สำหรับส่งต่อ

## หลักการอ่าน

- เส้นทึบ = Foreign Key ที่ฐานข้อมูลบังคับจริง; ลูกศรชี้จากตารางแม่ไปตารางลูก
- เส้นประ = ความสัมพันธ์จาก JSONB/ตรรกะแอป ไม่ใช่ FK ของ PostgreSQL
- รูปแบบ 1 : 0..* หมายถึงรายการแม่หนึ่งรายการมีรายการลูกได้ศูนย์ถึงหลายรายการ; 0..1 คือไม่บังคับหรือมีได้สูงสุดหนึ่งรายการ
- กล่องสีม่วง = array/object ที่ฝังใน JSONB ไม่ใช่ตาราง SQL; สีเทา = โครงสร้างรหัสผ่านเดิม
- หน้า logical แสดงฟิลด์ของ payload; หน้า physical แสดงคอลัมน์ SQL จริงทั้งหมด

## PostgreSQL ปัจจุบัน

Schema `kku_private`: 23 ตาราง, 51 คอลัมน์, 4 Foreign Keys; RLS เปิดครบทุกตาราง (ยืนยันจาก metadata ของฐานข้อมูลจริง)

Login ที่เปิดใช้ในโค้ดปัจจุบันคือ Google OAuth ผ่าน NestJS และ session ของแอปเอง ไม่ใช้ตาราง Supabase Auth; `credentials` และ `password_tokens` ยังอยู่เพื่อรองรับข้อมูลเดิม แต่เส้นทางสมัคร/เข้าสู่ระบบด้วยรหัสผ่านถูกปิด

### Foreign Keys ที่บังคับจริง

| ตารางลูก / คอลัมน์ | ตารางแม่ / คอลัมน์ |
| --- | --- |
| `bookings` | `FOREIGN KEY (room_key) REFERENCES kku_private.rooms(key)` |
| `bookings` | `FOREIGN KEY (user_key) REFERENCES kku_private.users(key)` |
| `credentials` | `FOREIGN KEY (key) REFERENCES kku_private.users(key)` |
| `rooms` | `FOREIGN KEY (building_key) REFERENCES kku_private.buildings(key)` |

### ตารางและคอลัมน์ทั้งหมด

ทุกคอลัมน์เป็น NOT NULL ทุกตารางยกเว้น app_lock มี `key text PRIMARY KEY` และ `payload jsonb NOT NULL`. ID ตัวเลขใน payload ถูกแปลงเป็นข้อความสำหรับ key

| ตาราง | ความหมายของ PK | คอลัมน์ SQL |
| --- | --- | --- |
| `app_lock` | `id = 1` | `id integer` |
| `assignments` | `String(payload.userId)` | `key text`; `payload jsonb` |
| `attempts` | `actorId + ':' + request key` | `key text`; `payload jsonb` |
| `audit` | `String(payload.id)` | `key text`; `payload jsonb` |
| `bookings` | `String(payload.id)` | `key text`; `payload jsonb`; `user_key text`; `room_key text`; `start_at timestamp with time zone`; `end_at timestamp with time zone`; `status text` |
| `buildings` | `String(payload.id)` | `key text`; `payload jsonb` |
| `closures` | `String(payload.id)` | `key text`; `payload jsonb` |
| `credentials` | `String(payload.userId)` | `key text`; `payload jsonb` |
| `equipment` | `String(payload.id)` | `key text`; `payload jsonb` |
| `flows` | `payload.hash` | `key text`; `payload jsonb` |
| `holidays` | `date string` | `key text`; `payload jsonb` |
| `identities` | `payload.subject` | `key text`; `payload jsonb` |
| `inspections` | `String(payload.id)` | `key text`; `payload jsonb` |
| `messages` | `String(payload.id)` | `key text`; `payload jsonb` |
| `notices` | `String(payload.id)` | `key text`; `payload jsonb` |
| `outbox` | `String(payload.noticeId)` | `key text`; `payload jsonb` |
| `password_tokens` | `payload.tokenHash` | `key text`; `payload jsonb` |
| `penalties` | `String(payload.id)` | `key text`; `payload jsonb` |
| `rooms` | `String(payload.id)` | `key text`; `payload jsonb`; `building_key text GENERATED STORED` |
| `sessions` | `payload.hash` | `key text`; `payload jsonb` |
| `settings` | `'site'` | `key text`; `payload jsonb` |
| `users` | `String(payload.id)` | `key text`; `payload jsonb` |
| `violations` | `String(payload.id)` | `key text`; `payload jsonb` |

### JSONB data dictionary

? หมายถึง property ที่ optional ใน TypeScript ไม่ใช่คอลัมน์ SQL ที่ nullable; properties ใน object ย่อยใช้รูปแบบเดียวกัน

BookingStatus = PENDING, APPROVED, REJECTED, CANCELLED, CHECKED_IN, COMPLETED, NO_SHOW

| ตาราง | properties ใน payload |
| --- | --- |
| `users` | `id: number`<br>`name: string`<br>`email: string`<br>`phone: string`<br>`affiliation: string`<br>`role: USER \| STAFF \| ADMIN`<br>`active: boolean` |
| `buildings` | `id: number`<br>`name: string`<br>`floors: number`<br>`active?: boolean` |
| `rooms` | `id: number`<br>`code: string`<br>`name: string`<br>`buildingId: number`<br>`floor: number`<br>`capacity: number`<br>`type: string`<br>`amenities: string[]`<br>`status: AVAILABLE \| MAINTENANCE \| CLOSED`<br>`reason: string`<br>`scene: number`<br>`active?: boolean`<br>`imageUrl?: string`<br>`inventory?: {id, name, total, damaged}[]`<br>`hours?: {start, end, weekdays[], leadMinutes}` |
| `equipment` | `id: number`<br>`name: string`<br>`total: number`<br>`remaining: number` |
| `bookings` | `id: number`<br>`ref: string`<br>`userId: number`<br>`roomId: number`<br>`start: string (ISO timestamp)`<br>`end: string (ISO timestamp)`<br>`purpose: string`<br>`attendees: number`<br>`participants: number[] (legacy; server rejects nonempty)`<br>`equipment: {id, qty, issued?, returned?}[]`<br>`status: BookingStatus`<br>`createdAt: string`<br>`decidedAt?: string`<br>`decidedBy?: number`<br>`checkedInAt?: string`<br>`reason?: string`<br>`participantEmails?: string[]`<br>`approvalDeadline?: string`<br>`slaReminderAt?: string`<br>`slaEscalatedAt?: string`<br>`archivedAt?: string` |
| `notices` | `id: number`<br>`userId: number`<br>`bookingId?: number`<br>`subject: string`<br>`content: string`<br>`status: QUEUED \| SENT \| FAILED`<br>`createdAt: string`<br>`attempts: number`<br>`readAt?: string` |
| `violations` | `id: number`<br>`userId: number`<br>`bookingId: number`<br>`type: NO_SHOW \| LATE_CANCEL`<br>`at: string` |
| `penalties` | `id: number`<br>`userId: number`<br>`type: WARNING \| SUSPENSION`<br>`start: string`<br>`end: string`<br>`reason: string`<br>`at: string`<br>`actorId: number` |
| `closures` | `id: number`<br>`roomId: number`<br>`start: string`<br>`end: string`<br>`reason: string` |
| `inspections` | `id: number`<br>`roomId: number`<br>`at: string`<br>`condition: string`<br>`note: string`<br>`actorId: number`<br>`items?: {id, name, total, damaged}[] (room inventory snapshot)` |
| `messages` | `id: number`<br>`userId: number`<br>`question: string`<br>`answer: string`<br>`at: string` |
| `audit` | `id: number`<br>`at: string`<br>`actorId: number \| null (system)`<br>`text: string`<br>`bookingId?: number` |
| `holidays` | `JSON string: "YYYY-MM-DD" (not an object)` |
| `assignments` | `userId: number`<br>`roomIds: number[]`<br>`start?: string`<br>`end?: string` |
| `identities` | `subject: string (Google subject)`<br>`userId: number` |
| `sessions` | `hash: string`<br>`userId: number`<br>`csrf: string`<br>`expiresAt: string` |
| `attempts` | `key: string`<br>`actorId: number (0 for auth rate counters)`<br>`hash: string`<br>`bookingId?: number`<br>`at: string`<br>`rejection?: {code, message}`<br>`rateCount?: number`<br>`rateUntil?: string` |
| `outbox` | `noticeId: number`<br>`status: QUEUED \| SENDING \| SENT \| FAILED`<br>`attempts: number`<br>`nextAt: string`<br>`leaseUntil?: string`<br>`leaseToken?: string`<br>`sentAt?: string`<br>`error?: string` |
| `flows` | `hash: string`<br>`verifier: string`<br>`state: string`<br>`nonce: string`<br>`expiresAt: string` |
| `credentials` | `userId: number`<br>`passwordHash: string (Argon2id)`<br>`updatedAt: string`<br>`failedAttempts: number`<br>`lockedUntil?: string` |
| `password_tokens` | `tokenHash: string`<br>`kind: register \| reset`<br>`email: string`<br>`name?: string`<br>`passwordHash?: string`<br>`userId?: number`<br>`expiresAt: string` |
| `settings` | `contactEmail: string`<br>`contactPhone: string`<br>`faqs: {q, a, keys[]}[]`<br>`workerAt?: string` |

### ความสัมพันธ์ JSONB ที่ควรทราบ

| อ้างอิงจาก | ไปยัง | การเก็บจริง |
| --- | --- | --- |
| bookings.decidedBy? | users.id | ผู้พิจารณา; ไม่ใช่ FK |
| bookings.equipment[].id | equipment.id | รายการยืมฝังใน booking; qty / issued / returned |
| bookings.participantEmails[] | อีเมลผู้ร่วมใช้งาน | string array; ไม่บังคับเป็นผู้ใช้ในระบบ |
| bookings.participants[] | users.id เดิม | field compatibility; server ไม่รับรายการ ID ที่ไม่ว่าง |
| notices.userId / bookingId? | users.id / bookings.id | ผู้รับและการจองที่เกี่ยวข้อง |
| violations.userId / bookingId | users.id / bookings.id | บันทึกความผิด |
| penalties.userId / actorId | users.id | ผู้ถูกลงโทษและผู้พิจารณา |
| closures.roomId | rooms.id | ปิดห้องเป็นช่วงเวลา |
| inspections.roomId / actorId | rooms.id / users.id | ตรวจห้อง; items เป็น snapshot ของ room.inventory |
| messages.userId | users.id | คำถาม/ความช่วยเหลือ |
| audit.actorId / bookingId? | users.id / bookings.id | actorId เป็น null ได้เมื่อเป็นเหตุการณ์ระบบ |
| assignments.userId / roomIds[] | users.id / rooms.id | หนึ่งแถวต่อ STAFF; array ห้องที่ได้รับมอบหมาย |
| identities.userId / sessions.userId | users.id | บัญชี Google และ session; ไม่มี FK |
| attempts.actorId / bookingId? | users.id / bookings.id | actorId=0 สำหรับ counter ก่อน login จึงไม่ใช่ user ทุกแถว |
| outbox.noticeId | notices.id | หนึ่งแถวคิวต่อแจ้งเตือนหนึ่งรายการ |
| password_tokens.userId? | users.id | optional สำหรับระบบรหัสผ่านเดิม |

ไม่มีตาราง staff, floor, room_type, booking_equipment, booking_participant, room_equipment, help_faq หรือ report แยกใน PostgreSQL ปัจจุบัน: บทบาท/ชั้น/ชนิดห้องเป็นฟิลด์ รายการอุปกรณ์และ FAQ เป็น JSON arrays และรายงานคำนวณจากข้อมูล

### Constraints และ indexes

- rooms.building_key เป็น generated stored column จาก payload.buildingId
- Unique email/code แบบไม่สนตัวพิมพ์ใหญ่เล็ก และ unique (bookingId,type) ของ violations
- การจอง 30 นาทีถึง 4 ชั่วโมง; GiST exclusion constraint กันช่วงเวลาทับซ้อนสำหรับ PENDING / APPROVED / CHECKED_IN
- Trigger ป้องกันเปลี่ยนเจ้าของ ห้อง และเวลาการจอง พร้อมตรวจการเปลี่ยนสถานะ
- app_lock.id=1 ใช้ล็อกการเขียนข้าม API/worker; settings.key='site' เป็น singleton
- payload ของ holidays เป็น JSON string; ตาราง JSONB อื่นเป็น object

รายละเอียดยืนยันจาก [schema-metadata.json](schema-metadata.json) ซึ่งมี columns, constraints, indexes และ RLS; source triggers อยู่ใน migration

## Oracle เดิมและ SQL ที่ปรับปรุง

โมเดลจากไฟล์ SQL มี 30 ตาราง (18 เดิม + 12 เพิ่ม รวม migration journal), 40 Foreign Keys

เป็น schema ตาม source ที่แนะนำหลังใช้ SAfordata_claude.sql และ SAfordata_business_security.sql ไม่ใช่ metadata ของ Oracle ที่ติดตั้งจริง ยังไม่ได้ยืนยันการรัน migration บน Oracle และแอปปัจจุบันไม่มี Oracle adapter

หน้า 04 แสดงตารางเดิมพร้อม key/field หลังปรับปรุง; หน้า 05 แสดงตารางเพิ่มพร้อม reference กลับไปหน้า 04 ด้านล่างเป็น catalogue คอลัมน์ทั้งหมดหลังการปรับปรุง

### Oracle columns

| ตาราง | Primary Key | คอลัมน์ (เครื่องหมาย ? = nullable) |
| --- | --- | --- |
| `affiliation` | `affiliation_id` | `affiliation_id NUMBER(10)`<br>`affiliation_name VARCHAR2(255)` |
| `booking` | `booking_id` | `booking_id NUMBER(10)`<br>`booking_date DATE`<br>`start_time TIMESTAMP`<br>`end_time TIMESTAMP`<br>`purpose VARCHAR2(500) ?`<br>`booking_status VARCHAR2(50)`<br>`actual_checkin_time TIMESTAMP ?`<br>`users_user_id NUMBER(10)`<br>`room_room_id NUMBER(10)`<br>`staff_staff_id NUMBER(10) ?`<br>`created_at TIMESTAMP WITH LOCAL TIME ZONE`<br>`updated_at TIMESTAMP WITH LOCAL TIME ZONE ?`<br>`approved_at TIMESTAMP WITH LOCAL TIME ZONE ?`<br>`reject_reason VARCHAR2(500) ?`<br>`expected_attendees NUMBER(5)`<br>`approval_deadline TIMESTAMP ?`<br>`cancel_reason VARCHAR2(500) ?`<br>`version NUMBER(10)`<br>`decided_actor_user_id NUMBER(10) ?` |
| `booking_equipment` | `booking_booking_id, equipment_equipment_id` | `booking_booking_id NUMBER(10)`<br>`equipment_equipment_id NUMBER(10)`<br>`borrowed_qty NUMBER(5)`<br>`issued_qty NUMBER(5)`<br>`returned_qty NUMBER(5)`<br>`released_qty NUMBER(5)` |
| `booking_log` | `booking_log_id` | `booking_log_id NUMBER(10)`<br>`action_type VARCHAR2(100)`<br>`action_time TIMESTAMP`<br>`booking_booking_id NUMBER(10)`<br>`users_user_id NUMBER(10) ?`<br>`actor_type VARCHAR2(10)`<br>`affected_user_id NUMBER(10) ?`<br>`violation_flag NUMBER(1)` |
| `booking_participant` | `booking_booking_id, users_user_id` | `booking_booking_id NUMBER(10)`<br>`users_user_id NUMBER(10)`<br>`participation_status VARCHAR2(50)` |
| `booking_violation` | `violation_id` | `violation_id NUMBER(10)`<br>`booking_id NUMBER(10)`<br>`affected_user_id NUMBER(10)`<br>`violation_type VARCHAR2(20)`<br>`occurred_at TIMESTAMP`<br>`source_event_key VARCHAR2(150)` |
| `building` | `building_id` | `building_id NUMBER(10)`<br>`building_name VARCHAR2(255)`<br>`address VARCHAR2(255) ?` |
| `command_attempt` | `actor_user_id, request_key` | `actor_user_id NUMBER(10)`<br>`request_key VARCHAR2(100)`<br>`request_hash VARCHAR2(64)`<br>`result_json CLOB ?`<br>`created_at TIMESTAMP` |
| `equipment` | `equipment_id` | `equipment_id NUMBER(10)`<br>`equipment_name VARCHAR2(255)`<br>`equipment_type VARCHAR2(100) ?`<br>`equipment_status VARCHAR2(50)`<br>`remaining_qty NUMBER(5)`<br>`created_at TIMESTAMP WITH LOCAL TIME ZONE ?`<br>`updated_at TIMESTAMP WITH LOCAL TIME ZONE ?`<br>`created_by_user_id NUMBER(10) ?`<br>`is_deleted NUMBER(1)`<br>`deleted_at TIMESTAMP WITH LOCAL TIME ZONE ?`<br>`total_qty NUMBER(5)`<br>`usage_type VARCHAR2(20)` |
| `floor` | `floor_id` | `floor_id NUMBER(10)`<br>`floor_number VARCHAR2(50)`<br>`building_building_id NUMBER(10)` |
| `help_faq` | `faq_id` | `faq_id NUMBER(10)`<br>`question VARCHAR2(300)`<br>`answer VARCHAR2(2000)`<br>`is_active NUMBER(1)` |
| `help_message` | `message_id` | `message_id NUMBER(10)`<br>`user_id NUMBER(10)`<br>`question VARCHAR2(1000)`<br>`answer VARCHAR2(2000) ?`<br>`created_at TIMESTAMP` |
| `holiday` | `holiday_id` | `holiday_id NUMBER(10)`<br>`holiday_date DATE`<br>`description VARCHAR2(255) ?` |
| `kku_app_lock` | `id` | `id NUMBER(1)` |
| `kku_schema_migration` | `name` | `name VARCHAR2(100)`<br>`status VARCHAR2(10)`<br>`applied_at TIMESTAMP ?` |
| `login_credential` | `user_id` | `user_id NUMBER(10)`<br>`password_hash VARCHAR2(512)`<br>`failed_attempts NUMBER(5)`<br>`locked_until TIMESTAMP ?`<br>`updated_at TIMESTAMP` |
| `login_identity` | `provider, subject` | `provider VARCHAR2(20)`<br>`subject VARCHAR2(255)`<br>`user_id NUMBER(10)` |
| `login_session` | `token_hash` | `token_hash VARCHAR2(64)`<br>`user_id NUMBER(10)`<br>`csrf_hash VARCHAR2(64)`<br>`expires_at TIMESTAMP` |
| `notification` | `notification_id` | `notification_id NUMBER(10)`<br>`noti_type VARCHAR2(50)`<br>`content VARCHAR2(1000) ?`<br>`recipient_email VARCHAR2(100) ?`<br>`send_time TIMESTAMP ?`<br>`booking_booking_id NUMBER(10) ?`<br>`users_user_id NUMBER(10)`<br>`template_code VARCHAR2(50)`<br>`params_json VARCHAR2(1000) ?`<br>`created_at TIMESTAMP WITH LOCAL TIME ZONE`<br>`channel VARCHAR2(10)`<br>`delivery_status VARCHAR2(10)`<br>`attempts NUMBER(5)`<br>`next_attempt_at TIMESTAMP`<br>`lease_until TIMESTAMP ?`<br>`lease_token VARCHAR2(64) ?`<br>`last_error VARCHAR2(500) ?`<br>`source_event_key VARCHAR2(150) ?` |
| `penalty` | `penalty_id` | `penalty_id NUMBER(10)`<br>`penalty_type VARCHAR2(100)`<br>`start_date DATE ?`<br>`end_date DATE ?`<br>`reason VARCHAR2(500) ?`<br>`penalty_status VARCHAR2(50)`<br>`users_user_id NUMBER(10)`<br>`staff_staff_id NUMBER(10) ?`<br>`booking_booking_id NUMBER(10) ?`<br>`created_at TIMESTAMP WITH LOCAL TIME ZONE`<br>`updated_at TIMESTAMP WITH LOCAL TIME ZONE ?`<br>`decided_at TIMESTAMP`<br>`count_from_at TIMESTAMP`<br>`decided_by NUMBER(10) ?` |
| `report` | `report_id` | `report_id NUMBER(10)`<br>`report_type VARCHAR2(100)`<br>`report_date DATE`<br>`total_bookings NUMBER(6)`<br>`users_user_id NUMBER(10) ?`<br>`total_hours NUMBER(8, 2)`<br>`canceled_count NUMBER(6) ?`<br>`created_at TIMESTAMP WITH LOCAL TIME ZONE` |
| `room` | `room_id` | `room_id NUMBER(10)`<br>`room_name VARCHAR2(100)`<br>`capacity NUMBER(5)`<br>`room_status VARCHAR2(50)`<br>`image_url VARCHAR2(500) ?`<br>`floor_floor_id NUMBER(10)`<br>`room_type_room_type_id NUMBER(10)`<br>`is_deleted NUMBER(1)`<br>`deleted_at TIMESTAMP WITH LOCAL TIME ZONE ?` |
| `room_assignment` | `staff_staff_id, room_room_id` | `staff_staff_id NUMBER(10)`<br>`room_room_id NUMBER(10)`<br>`start_date DATE ?`<br>`work_shift VARCHAR2(50) ?`<br>`end_date DATE ?`<br>`assignment_status VARCHAR2(10)` |
| `room_closure` | `closure_id` | `closure_id NUMBER(10)`<br>`room_id NUMBER(10)`<br>`start_at TIMESTAMP`<br>`end_at TIMESTAMP`<br>`reason VARCHAR2(500)`<br>`actor_user_id NUMBER(10)` |
| `room_equipment` | `room_room_id, equipment_equipment_id` | `room_room_id NUMBER(10)`<br>`equipment_equipment_id NUMBER(10)`<br>`quantity NUMBER(5)`<br>`equip_status VARCHAR2(50) ?` |
| `room_inspection` | `inspection_id` | `inspection_id NUMBER(10)`<br>`room_id NUMBER(10)`<br>`actor_user_id NUMBER(10)`<br>`inspected_at TIMESTAMP`<br>`condition VARCHAR2(100)`<br>`note VARCHAR2(1000) ?`<br>`items_json CLOB ?` |
| `room_type` | `room_type_id` | `room_type_id NUMBER(10)`<br>`type_name VARCHAR2(100)`<br>`description VARCHAR2(500) ?` |
| `staff` | `staff_id` | `staff_id NUMBER(10)`<br>`job_title VARCHAR2(100) ?`<br>`start_date DATE ?`<br>`staff_status VARCHAR2(50)`<br>`users_user_id NUMBER(10)` |
| `stock_movement` | `movement_id` | `movement_id NUMBER(10)`<br>`booking_id NUMBER(10)`<br>`equipment_id NUMBER(10)`<br>`movement_type VARCHAR2(10)`<br>`quantity NUMBER(5)`<br>`source_event_key VARCHAR2(150)`<br>`occurred_at TIMESTAMP` |
| `users` | `user_id` | `user_id NUMBER(10)`<br>`full_name VARCHAR2(255)`<br>`email VARCHAR2(100)`<br>`phone VARCHAR2(20) ?`<br>`role_level VARCHAR2(50)`<br>`account_status VARCHAR2(50)`<br>`affiliation_affiliation_id NUMBER(10) ?`<br>`created_at TIMESTAMP WITH LOCAL TIME ZONE ?`<br>`updated_at TIMESTAMP WITH LOCAL TIME ZONE ?`<br>`is_deleted NUMBER(1)`<br>`deleted_at TIMESTAMP WITH LOCAL TIME ZONE ?` |

### Oracle Foreign Keys

| ตารางลูก / คอลัมน์ | ตารางแม่ / คอลัมน์ | nullable |
| --- | --- | --- | --- |
| `booking_equipment.booking_booking_id` | `booking.booking_id` | no |
| `booking_equipment.equipment_equipment_id` | `equipment.equipment_id` | no |
| `booking_log.booking_booking_id` | `booking.booking_id` | no |
| `booking_log.users_user_id` | `users.user_id` | yes |
| `booking_participant.booking_booking_id` | `booking.booking_id` | no |
| `booking_participant.users_user_id` | `users.user_id` | no |
| `booking.room_room_id` | `room.room_id` | no |
| `booking.staff_staff_id` | `staff.staff_id` | yes |
| `booking.users_user_id` | `users.user_id` | no |
| `floor.building_building_id` | `building.building_id` | no |
| `notification.booking_booking_id` | `booking.booking_id` | yes |
| `notification.users_user_id` | `users.user_id` | no |
| `penalty.booking_booking_id` | `booking.booking_id` | yes |
| `penalty.staff_staff_id` | `staff.staff_id` | yes |
| `penalty.users_user_id` | `users.user_id` | no |
| `report.users_user_id` | `users.user_id` | yes |
| `room_assignment.room_room_id` | `room.room_id` | no |
| `room_assignment.staff_staff_id` | `staff.staff_id` | no |
| `room_equipment.equipment_equipment_id` | `equipment.equipment_id` | no |
| `room_equipment.room_room_id` | `room.room_id` | no |
| `room.floor_floor_id` | `floor.floor_id` | no |
| `room.room_type_room_type_id` | `room_type.room_type_id` | no |
| `staff.users_user_id` | `users.user_id` | no |
| `users.affiliation_affiliation_id` | `affiliation.affiliation_id` | yes |
| `booking_log.affected_user_id` | `users.user_id` | yes |
| `equipment.created_by_user_id` | `users.user_id` | yes |
| `room_closure.room_id` | `room.room_id` | no |
| `room_closure.actor_user_id` | `users.user_id` | no |
| `booking_violation.booking_id` | `booking.booking_id` | no |
| `booking_violation.affected_user_id` | `users.user_id` | no |
| `command_attempt.actor_user_id` | `users.user_id` | no |
| `login_identity.user_id` | `users.user_id` | no |
| `login_credential.user_id` | `users.user_id` | no |
| `login_session.user_id` | `users.user_id` | no |
| `room_inspection.room_id` | `room.room_id` | no |
| `room_inspection.actor_user_id` | `users.user_id` | no |
| `help_message.user_id` | `users.user_id` | no |
| `stock_movement.booking_id,equipment_id` | `booking_equipment.booking_booking_id,equipment_equipment_id` | no |
| `booking.decided_actor_user_id` | `users.user_id` | yes |
| `penalty.decided_by` | `users.user_id` | yes |

### แหล่งข้อมูล

- [TypeScript business contracts](../../packages/contracts/src/index.ts)
- [Server persistence types](../../apps/backend/src/infrastructure/store.ts)
- [PostgreSQL adapter และ key mapping](../../apps/backend/src/infrastructure/postgres-store.ts)
- [PostgreSQL migrations](../../supabase/migrations/)
- [Google-only login](../MOBILE_UI_GOOGLE_LOGIN.md)
- [SQL security](../SQL_SECURITY.md)
- [Oracle DDL](../../../Request/SAfordata.ddl)
- [Oracle base migration](../../../Request/SAfordata_claude.sql)
- [Oracle extension migration](../../../Request/SAfordata_business_security.sql)

สร้างซ้ำ: รัน `python docs/diagrams/generate_diagrams.py` จาก repository โดยติดตั้ง Pillow และมี fonts Segoe UI (Windows) ใช้ metadata snapshot ที่เก็บไว้ ไม่เชื่อมต่อฐานข้อมูล
