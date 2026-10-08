import { SERVICE_TYPE } from '@podbor/shop-catalog';
import {
  ORDER_HOOK_HEADER,
  ORDER_HOOK_LIMITS,
  type OrderHookPayload,
  orderHookSchema,
  signHook,
} from '@podbor/shop-catalog/order-hook';
import { z } from 'zod';

import { CHANNEL_FIELD, COMMENT_FIELD, fullName } from '../api/store/contact';
import { money } from './money';
import { shopLocale } from './shop';

const nullableText = z.string().nullish();

export const hookOrderSchema = z.object({
  id: z.string(),
  display_id: z.union([z.number(), z.string()]),
  email: nullableText,
  locale: nullableText,
  total: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  shipping_address: z
    .object({
      first_name: nullableText,
      last_name: nullableText,
      phone: nullableText,
    })
    .nullish(),
  items: z
    .array(
      z
        .object({
          product_id: nullableText,
          product_title: nullableText,
          quantity: z.unknown(),
          unit_price: z.unknown(),
        })
        .nullable(),
    )
    .nullish(),
});

export type HookOrder = z.infer<typeof hookOrderSchema>;

export const hookProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.object({ value: nullableText }).nullish(),
});

export type HookProduct = z.infer<typeof hookProductSchema>;

const extrasSchema = z.object({
  [COMMENT_FIELD]: z.string().optional(),
  [CHANNEL_FIELD]: z.string().optional(),
});

const REQUEST_TIMEOUT_MS = 15_000;

export function buildOrderHookPayload(
  order: HookOrder,
  products: readonly HookProduct[],
  adminUrl: string,
): OrderHookPayload {
  const byId = new Map(products.map((product) => [product.id, product]));
  const extras = extrasSchema.safeParse(order.metadata ?? {});
  const comment = extras.success
    ? extras.data[COMMENT_FIELD]?.trim()
    : undefined;
  const channel = extras.success
    ? extras.data[CHANNEL_FIELD]?.trim()
    : undefined;

  return orderHookSchema.parse({
    orderId: order.id,
    displayId: Number(order.display_id),
    locale: shopLocale(order.locale),
    customer: {
      name: fullName(order.shipping_address),
      phone: order.shipping_address?.phone,
      email: order.email,
      channel: channel || undefined,
    },
    items: (order.items ?? []).flatMap((item) => {
      if (!item) {
        return [];
      }
      const product = byId.get(item.product_id ?? '');
      const title = Array.from(
        (product?.title ?? item.product_title ?? '').trim(),
      )
        .slice(0, ORDER_HOOK_LIMITS.title)
        .join('');
      return [
        {
          title,
          quantity: money(item.quantity),
          unitPrice: money(item.unit_price),
          isService: product?.type?.value === SERVICE_TYPE,
        },
      ];
    }),
    total: money(order.total),
    comment: comment || undefined,
    adminUrl: `${adminUrl}/orders/${order.id}`,
  });
}

export async function sendOrderHook(
  payload: OrderHookPayload,
  target: { url: string; secret: string },
  send: typeof fetch = fetch,
): Promise<void> {
  const body = JSON.stringify(payload);
  const response = await send(target.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [ORDER_HOOK_HEADER]: signHook(body, target.secret),
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await response.body?.cancel();
  if (!response.ok) {
    throw new Error(`Order hook answered ${response.status}`);
  }
}
