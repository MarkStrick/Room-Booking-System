import { z } from 'zod';
const id = z.number().int().positive().max(2147483647);
const text = (max = 500) => z.string().trim().min(1).max(max);
const timestamp = z.iso.datetime({offset:true});
const date = z.iso.date();
const clock=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const room = z.strictObject({id:id.optional(),name:text(120),code:text(30),buildingId:id,floor:id,capacity:id,type:text(80),amenities:z.array(text(80)).max(20),status:z.enum(['AVAILABLE','MAINTENANCE','CLOSED']),reason:z.string().max(500),scene:z.number().int().min(0).max(20),active:z.boolean().optional(),imageUrl:z.union([z.literal(''),z.url().refine(u=>u.startsWith('https://'))]).optional(),inventory:z.array(z.strictObject({id,name:text(120),total:z.number().int().min(1).max(10000),damaged:z.number().int().min(0)})).max(50).optional(),hours:z.strictObject({start:clock,end:clock,weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(7),leadMinutes:z.number().int().min(0).max(1440)}).optional()});
export const commandSchema = z.discriminatedUnion('type', [
 z.strictObject({type:z.literal('BOOK'),roomId:id,start:timestamp,end:timestamp,purpose:text(),attendees:id,participants:z.array(id).max(200).refine(a=>new Set(a).size===a.length),participantEmails:z.array(z.email().max(254)).max(200).optional(),equipment:z.array(z.strictObject({id,qty:id})).max(50)}),
 z.strictObject({type:z.enum(['CANCEL','CHECKIN']),bookingId:id}),
 z.strictObject({type:z.literal('DECIDE'),bookingId:id,approve:z.boolean(),reason:z.string().max(500)}),
 z.strictObject({type:z.literal('ROOM_SAVE'),room}),
 z.strictObject({type:z.literal('CLOSE_ROOM'),roomId:id,start:timestamp,end:timestamp,reason:text()}),
 z.strictObject({type:z.literal('INSPECT'),roomId:id,condition:z.enum(['พร้อมใช้งาน','พบอุปกรณ์ชำรุด','ต้องทำความสะอาด','ต้องซ่อมบำรุง']),note:z.string().max(1000),items:z.array(z.strictObject({id,damaged:z.number().int().min(0).max(10000)})).max(50).optional()}),
 z.strictObject({type:z.literal('BUILDING_SAVE'),id:id.optional(),name:text(120),floors:id}),
 z.strictObject({type:z.literal('HOLIDAY_SAVE'),date,previousDate:date.optional()}),
 z.strictObject({type:z.literal('HOLIDAY_DELETE'),date}),
 z.strictObject({type:z.literal('ROOM_ACTIVE'),roomId:id,active:z.boolean()}),
 z.strictObject({type:z.literal('BUILDING_ACTIVE'),buildingId:id,active:z.boolean()}),
 z.strictObject({type:z.literal('ROOM_DELETE'),roomId:id}),
 z.strictObject({type:z.literal('BUILDING_DELETE'),buildingId:id}),
 z.strictObject({type:z.literal('EQUIPMENT_HANDOVER'),bookingId:id,equipmentId:id,qty:id,action:z.enum(['ISSUE','RETURN'])}),
 z.strictObject({type:z.literal('SETTINGS_SAVE'),contactEmail:z.union([z.literal(''),z.email()]),contactPhone:z.string().max(30).regex(/^[0-9+ ()-]*$/),faqs:z.array(z.strictObject({q:text(300),a:text(2000),keys:z.array(text(80)).min(1).max(20)})).min(1).max(100)}),
 z.strictObject({type:z.literal('EQUIPMENT_SAVE'),id:id.optional(),name:text(120),total:z.number().int().min(0).max(100000)}),
 z.strictObject({type:z.literal('PENALTY'),userId:id,penaltyType:z.enum(['WARNING','SUSPENSION']),start:date,end:date,reason:text()}),
 z.strictObject({type:z.literal('PROFILE'),name:text(120),phone:z.string().regex(/^[0-9+ -]{8,20}$/)}),
 z.strictObject({type:z.literal('HELP'),question:text(1000)}),
 z.strictObject({type:z.literal('SUPPORT_REQUEST'),question:text(1000)}),
 z.strictObject({type:z.enum(['RETRY','READ_NOTICE']),noticeId:id})
]);
export const assignmentSchema = z.strictObject({userId:id,role:z.enum(['USER','STAFF','ADMIN']),roomIds:z.array(id).max(1000),active:z.boolean(),start:date.optional(),end:date.optional()}).refine(a=>!a.start||!a.end||a.start<=a.end);
