import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const ORDER_HOOK_HEADER = 'x-carlab-signature';
export const ORDER_HOOK_TOLERANCE_SECONDS = 300;

export const orderHookSchema = z
  .object({
    orderId: z.string().min(1).max(100),
    displayId: z.number().int().positive(),
    locale: z.enum(['ru', 'sr', 'en']),
    customer: z
      .object({
        name: z.string().trim().min(1).max(200),
        phone: z.e164(),
        email: z.email(),
        channel: z.string().trim().max(40).optional(),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(300),
            quantity: z.number().int().positive().max(1000),
            unitPrice: z.number().nonnegative(),
            isService: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    total: z.number().nonnegative(),
    comment: z.string().trim().max(2000).optional(),
    adminUrl: z.url({ protocol: /^https$/ }),
  })
  .strict();

export type OrderHookPayload = z.infer<typeof orderHookSchema>;

const headerSchema = z.object({
  t: z.coerce.number().int().positive(),
  v1: z.string().regex(/^[0-9a-f]{64}$/),
});

function digest(body: string, secret: string, timestamp: number): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

export function signHook(
  body: string,
  secret: string,
  nowMs = Date.now(),
): string {
  if (!secret.trim()) throw new Error('order hook secret is empty');
  const timestamp = Math.floor(nowMs / 1000);
  return `t=${timestamp},v1=${digest(body, secret, timestamp)}`;
}

export function verifyHook(
  body: string,
  header: string | null,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!header || !secret.trim()) return false;
  const parsed = headerSchema.safeParse(
    Object.fromEntries(
      header.split(',').map((part) => part.trim().split('=', 2)),
    ),
  );
  if (!parsed.success) return false;
  const { t, v1 } = parsed.data;
  if (Math.abs(Math.floor(nowMs / 1000) - t) > ORDER_HOOK_TOLERANCE_SECONDS)
    return false;
  return timingSafeEqual(
    Buffer.from(v1, 'hex'),
    Buffer.from(digest(body, secret, t), 'hex'),
  );
}
