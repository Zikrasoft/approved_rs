import { z } from 'zod';

const senderSchema = z.object({
  id: z.number().int(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

const messageSchema = z.object({
  chat: z.object({ id: z.number().int(), type: z.string() }),
  from: senderSchema,
  text: z.string().optional(),
  contact: z.object({ phone_number: z.string() }).optional(),
});

export const captureUpdateSchema = z
  .object({ message: messageSchema.optional().catch(undefined) })
  .catch({ message: undefined });

export type CaptureMessage = z.infer<typeof messageSchema>;
export type CaptureSender = z.infer<typeof senderSchema>;
