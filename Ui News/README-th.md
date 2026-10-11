# Booking Room KKU UI Export

โคลนจาก https://github.com/siriphan9292/booking_room_kku

ประกอบด้วย UI หลัก 8 หน้า และแบบเต็มของหน้าจองห้อง/ตรวจสภาพห้อง ขนาดมือถือ 390 × 844 px
หน้าแจ้งเตือนเป็นสถานะว่างตามข้อมูลเริ่มต้น ภาพ PNG ใช้เปรียบเทียบเท่านั้น

## นำเข้าเร็ว
ลากไฟล์ SVG เข้า Figma ได้โดยตรง รูปทรงและไอคอนเป็นเวกเตอร์ แต่ Figma อาจแปลงข้อความเป็นเส้นเวกเตอร์

## นำเข้าให้แก้ข้อความได้
1. ติดตั้งฟอนต์ Sarabun (https://fonts.google.com/specimen/Sarabun) และเปิด Figma Desktop
2. ในไฟล์ Design เลือก Plugins → Development → Import plugin from manifest
3. เลือก figma-plugin/manifest.json ในชุดนี้
4. รัน Booking Room KKU UI Import จะได้ทุกหน้าและเลเยอร์ Text ที่แก้ไขได้

ปลั๊กอินทำงานออฟไลน์ ใช้รูปที่ฝังอยู่ในไฟล์แล้ว แต่การนำเข้าไม่ได้สร้าง Auto Layout หรือ Component variants
หากไม่มี Sarabun จะใช้ Noto Sans Thai หรือฟอนต์สำรอง ระยะข้อความอาจเปลี่ยน
ปลั๊กอินยังไม่ได้รันตรวจใน Figma เพราะ MCP บัญชี Starter เต็มโควตา

ไฟล์ export.py และ dom-to-svg.js ใช้สร้างไฟล์จาก UI จริง ส่วน verification.json บันทึกผลตรวจ browser
