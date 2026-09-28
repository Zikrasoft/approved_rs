import { z } from 'zod';

import { SHOP } from '../../lib/shop';

export const HONEYPOT_FIELD = 'website';
export const COMMENT_FIELD = 'comment';
export const CHANNEL_FIELD = 'contact_channel';

const contactSchema = z.object({
  email: z.email(),
  shipping_address: z.object({
    first_name: z.string().trim().min(1).max(200),
    phone: z.e164(),
    country_code: z.literal(SHOP.country),
  }),
  metadata: z
    .object({
      [COMMENT_FIELD]: z.string().max(2000).optional(),
      [CHANNEL_FIELD]: z.string().max(40).optional(),
    })
    .nullish(),
});

const trapSchema = z.object({
  metadata: z.object({ [HONEYPOT_FIELD]: z.literal('').optional() }).nullish(),
});

const FAULT_NAMES: Partial<Record<string, string>> = {
  email: 'email',
  shipping_address: 'имя и телефон',
  first_name: 'имя',
  phone: 'телефон в международном формате',
  country_code: 'страна получения — только Сербия',
  [COMMENT_FIELD]: 'комментарий длиннее 2000 знаков',
  [CHANNEL_FIELD]: 'способ связи',
};

export function contactFaults(cart: unknown): string[] {
  const result = contactSchema.safeParse(cart);
  if (result.success) {
    return [];
  }
  return [
    ...new Set(
      result.error.issues.map((issue) => {
        const field = String(issue.path[issue.path.length - 1]);
        return FAULT_NAMES[field] ?? issue.path.join('.');
      }),
    ),
  ];
}

export function isBot(cart: unknown): boolean {
  return !trapSchema.safeParse(cart).success;
}
