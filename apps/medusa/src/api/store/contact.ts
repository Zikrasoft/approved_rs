import { ORDER_HOOK_LIMITS } from '@podbor/shop-catalog/order-hook';
import { z } from 'zod';

import { SHOP } from '../../lib/shop';

export const HONEYPOT_FIELD = 'website';
export const COMMENT_FIELD = 'comment';
export const CHANNEL_FIELD = 'contact_channel';

type Named = { first_name?: string | null; last_name?: string | null };

export function fullName(address: Named | null | undefined): string {
  return [address?.first_name, address?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
}

const contactSchema = z.object({
  email: z.email(),
  shipping_address: z
    .object({
      first_name: z.string().trim().min(1),
      last_name: z.string().nullish(),
      phone: z.e164(),
      country_code: z.literal(SHOP.country),
    })
    .refine((address) => fullName(address).length <= ORDER_HOOK_LIMITS.name, {
      path: ['first_name'],
    }),
  metadata: z
    .object({
      [COMMENT_FIELD]: z.string().max(ORDER_HOOK_LIMITS.comment).optional(),
      [CHANNEL_FIELD]: z.string().max(ORDER_HOOK_LIMITS.channel).optional(),
    })
    .nullish(),
  items: z
    .array(
      z.object({
        quantity: z.coerce.number().max(ORDER_HOOK_LIMITS.quantity),
      }),
    )
    .max(ORDER_HOOK_LIMITS.items)
    .optional(),
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
  [COMMENT_FIELD]: `комментарий длиннее ${ORDER_HOOK_LIMITS.comment} знаков`,
  [CHANNEL_FIELD]: 'способ связи',
  items: `больше ${ORDER_HOOK_LIMITS.items} позиций в заказе`,
  quantity: `количество больше ${ORDER_HOOK_LIMITS.quantity}`,
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
