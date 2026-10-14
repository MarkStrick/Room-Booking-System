import { z } from 'zod';
const short = z.string().max(100);
export const assistantSearchSchema = z.object({
  date: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/), endDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
  capacity: z.number().int().min(1).max(10000), amenities: z.array(short).max(8), building: short, roomQuery: short,
}).strict();
export const assistantRequestSchema = z.object({ question: z.string().trim().min(1).max(1000), context: assistantSearchSchema.optional(), filters: assistantSearchSchema.optional() }).strict();
// Nullable fields work across provider structured-output schemas; no free-form answer is accepted.
export const assistantIntentSchema = z.object({
  kind: z.enum(['search','faq','booking-help','status-help','contact','out-of-scope']),
  date: z.string().nullable(), start: z.string().nullable(), end: z.string().nullable(), endDate: z.string().nullable(),
  capacity: z.number().int().nullable(), amenities: z.array(z.string()), building: z.string().nullable(), roomQuery: z.string().nullable(),
  faqIndex: z.number().int().nullable(), needsClarification: z.boolean(),
});
