# ผลตรวจ F04: วันหยุดมหาวิทยาลัย

ผู้ดูแลใช้หน้าอาคารและชั้นเพิ่ม/แก้ไข/ลบวันหยุด → POST /api/commands → transaction ฐานข้อมูล → state ล่าสุด → หน้าจอแสดงผลและกฎการจองใช้ปฏิทินใหม่

| ส่วนที่ตรวจ | ผล | หลักฐาน |
| --- | --- | --- |
| กฎธุรกิจ | ผ่าน 13/13 | สิทธิ์ ADMIN, วันที่จริง/อธิกสุรทิน/ซ้ำ, เพิ่ม/แก้/ลบ, ป้องกัน active booking ทั้งสามสถานะ, rollback และไม่อนุมัติบนวันหยุด |
| API และฐานข้อมูล | ผ่าน 22/22 | HTTP 403 สำหรับ USER/STAFF, 400 วันที่ไม่จริง, 409 วันที่ซ้ำ/กระทบ booking; PostgreSQL adapter/PGlite เก็บเพิ่ม–แก้–ลบในตาราง holidays เดิม |
| การสร้างแอป | ผ่าน | TypeScript ทั้งเว็บ/backend และ Vite build |
| Desktop 1440×1000 | ผ่าน | เพิ่ม โหลดหน้าใหม่ แก้วันที่ ยืนยันลบ และ empty state |
| Mobile 390×844 | ผ่าน | กระบวนการเดียวกัน ปุ่มใช้งานได้ ไม่ล้นแนวนอน ไม่มี browser page error |
| Mechanical UI detector | ผ่าน | ผล `[]` สำหรับ TSX ที่เปลี่ยน |

ภาพประกอบ: [Desktop](../preview/holiday-desktop.png), [Mobile](../preview/holiday-mobile.png), [ยืนยันลบบนมือถือ](../preview/holiday-delete-mobile.png)

ตรวจด้วยข้อมูลทดสอบ SQLite แยกจากข้อมูลใช้งานจริง เว็บเปิดผ่าน Vite preview เชื่อม API ในเครื่อง ไม่ได้ตรวจ cloud PostgreSQL/SMTP ในรอบนี้

พบปัญหาเดิมที่ backend ส่ง GET / เป็น 404 แม้ WEB_DIST มีไฟล์ เพราะ static ถูกเพิ่มหลัง app.init() บันทึกเป็น F12 ใน Audit และยังไม่ได้แก้ในรอบ F04 การตรวจหน้าจอจึงใช้ preview พร้อม proxy ไป API โดยไม่แก้ค่าของโครงการ
