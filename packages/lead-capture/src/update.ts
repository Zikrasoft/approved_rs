import type { Update } from 'grammy/types';
import { z } from 'zod';

const senderSchema = z.object({
  id: z.number().int(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

export const captureMessageSchema = z.object({
  chat: z.object({ id: z.number().int(), type: z.string() }),
  from: senderSchema,
  text: z.string().optional(),
  contact: z.object({ phone_number: z.string() }).optional(),
});

export const captureTapSchema = z.object({
  from: senderSchema,
  data: z.string(),
  message: z.object({
    message_id: z.number().int(),
    chat: z.object({ id: z.number().int() }),
  }),
});

const updateObjectSchema = z.object({});

export const captureUpdateSchema = z.custom<Update>(
  (value) => updateObjectSchema.safeParse(value).success,
);

export type CaptureSender = z.infer<typeof senderSchema>;
