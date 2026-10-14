import { z } from "zod";
import { commandSchema, assignmentSchema } from "./validation";
import { assistantRequestSchema } from './assistant-validation';
export function openApi(cookie: string) {
  const auth = { security: [{ sessionCookie: [] }] };
  const get = (summary: string, secured = true) => ({
    ...(secured ? auth : {}),
    summary,
    responses: {
      200: { description: "ข้อมูลตามขอบเขตสิทธิ์" },
      401: { description: "ต้องเข้าสู่ระบบ" },
    },
  });
  const post = (summary: string, schema: unknown) => ({
    ...auth,
    summary,
    parameters: [
      {
        in: "header",
        name: "x-csrf-token",
        required: true,
        schema: { type: "string" },
      },
    ],
    requestBody: {
      required: true,
      content: { "application/json": { schema } },
    },
    responses: {
      201: { description: "ทำรายการสำเร็จ" },
      400: { description: "ข้อมูลไม่ถูกต้อง" },
      401: { description: "ต้องเข้าสู่ระบบ" },
      403: { description: "ไม่มีสิทธิ์หรือ CSRF ไม่ถูกต้อง" },
      409: { description: "เงื่อนไขธุรกิจหรือข้อมูลขัดแย้ง" },
    },
  });
  return {
    openapi: "3.1.0",
    info: {
      title: "KKU Space API",
      version: "0.3.0",
      description:
        "API ของระบบปัจจุบัน ใช้ session cookie, CSRF และ transaction พร้อม idempotency สำหรับคำสั่ง",
    },
    components: {
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: cookie },
      },
    },
    paths: {
      "/api/public/catalog": {
        get: get(
          "ค้นหาพื้นที่และช่วงเวลาที่มีการจองโดยไม่ส่งข้อมูลส่วนตัว",
          false,
        ),
      },
      "/api/session": { get: get("บัญชี session และข้อมูลตามขอบเขต") },
      "/api/state": { get: get("ข้อมูลปัจจุบันตามขอบเขต") },
      "/api/assistant": { post: { ...post('ผู้ช่วยตอบ FAQ และค้นห้องว่างจากฐานข้อมูล ไม่สร้างการจอง', z.toJSONSchema(assistantRequestSchema)), responses: { 201: { description: 'คำตอบพร้อมห้องว่างและเวลาที่ตรวจสอบ' }, 400: { description: 'ข้อมูลไม่ถูกต้อง' }, 401: { description: 'ต้องเข้าสู่ระบบ' }, 403: { description: 'CSRF หรือสิทธิ์ไม่ถูกต้อง' }, 429: { description: 'ส่งคำถามถี่เกินไป' } } } },
      "/api/commands": {
        post: {
          ...post("คำสั่งธุรกิจ", z.toJSONSchema(commandSchema)),
          parameters: [
            {
              in: "header",
              name: "x-csrf-token",
              required: true,
              schema: { type: "string" },
            },
            {
              in: "header",
              name: "idempotency-key",
              required: true,
              schema: { type: "string", pattern: "^[A-Za-z0-9_-]{16,100}$" },
            },
          ],
        },
      },
      "/api/admin/access": {
        post: post(
          "กำหนดสิทธิ์และช่วงมอบหมายโดย ADMIN",
          z.toJSONSchema(assignmentSchema),
        ),
      },
      "/api/admin/operations": {
        get: get("สถานะ worker และคิวแจ้งเตือนสำหรับ ADMIN"),
      },
      "/api/admin/test-tools": { get: get("ยืนยันสิทธิ์ ADMIN ก่อนเปิดพื้นที่จำลองที่แยกจากฐานข้อมูลจริง") },
      "/api/admin/readiness": { get: get("รายการความพร้อมสำหรับ ADMIN ไม่ส่งค่าลับ") },
      "/api/health/live": { get: get("process ยังทำงาน", false) },
      "/api/health/ready": { get: get("ตรวจอ่านฐานข้อมูล", false) },
    },
  };
}
