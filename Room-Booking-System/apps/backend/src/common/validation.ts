import { z } from 'zod';
const id = z.number().int().positive().max(2147483647);
const text = (max = 500) => z.string().trim().min(1).max(max);
const timestamp = z.iso.datetime({offset:true});
const date = z.iso.date();
const room = z.strictObject({id:id.optional(),name:text(120),code:text(30),buildingId:id,floor:id,capacity:id,type:text(80),amenities:z.array(text(80)).max(20),status:z.enum(['AVAILABLE','MAINTENANCE','CLOSED']),reason:z.string().max(500),scene:z.number().int().min(0).max(20)});
export const commandSchema = z.discriminatedUnion('type', [
 z.strictObject({type:z.literal('BOOK'),roomId:id,start:timestamp,end:timestamp,purpose:text(),attendees:id,participants:z.array(id).max(200).refine(a=>new Set(a).size===a.length),equipment:z.array(z.strictObject({id,qty:id})).max(50)}),
 z.strictObject({type:z.enum(['CANCEL','CHECKIN']),bookingId:id}),
 z.strictObject({type:z.literal('DECIDE'),bookingId:id,approve:z.boolean(),reason:z.string().max(500)}),
 z.strictObject({type:z.literal('ROOM_SAVE'),room}),
 z.strictObject({type:z.literal('CLOSE_ROOM'),roomId:id,start:timestamp,end:timestamp,reason:text()}),
 z.strictObject({type:z.literal('INSPECT'),roomId:id,condition:z.enum(['พร้อมใช้งาน','พบอุปกรณ์ชำรุด','ต้องทำความสะอาด','ต้องซ่อมบำรุง']),note:z.string().max(1000)}),
 z.strictObject({type:z.literal('BUILDING_SAVE'),id:id.optional(),name:text(120),floors:id}),
 z.strictObject({type:z.literal('EQUIPMENT_SAVE'),id:id.optional(),name:text(120),total:z.number().int().min(0).max(100000)}),
 z.strictObject({type:z.literal('PENALTY'),userId:id,penaltyType:z.enum(['WARNING','SUSPENSION']),start:date,end:date,reason:text()}),
 z.strictObject({type:z.literal('PROFILE'),name:text(120),phone:z.string().regex(/^[0-9+ -]{8,20}$/)}),
 z.strictObject({type:z.literal('HELP'),question:text(1000)}),
 z.strictObject({type:z.enum(['RETRY','READ_NOTICE']),noticeId:id})
]);
export const assignmentSchema = z.strictObject({userId:id,role:z.enum(['USER','STAFF','ADMIN']),roomIds:z.array(id).max(1000),active:z.boolean()});
