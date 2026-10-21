import type { BigNumberValue } from '@medusajs/framework/types';
import { MathBN } from '@medusajs/framework/utils';
import { PARTS_ORDER_SERVICE } from '@podbor/brands';
import { z } from 'zod';

import { StoreCompleteOfferCart } from '../api/store/validators';

export const checkoutContactSchema = StoreCompleteOfferCart;

const LEAD_ROUTE_TIMEOUT_MS = 15_000;

const amount = z.preprocess(
  (value) =>
    value === undefined
      ? value
      : MathBN.convert(value as BigNumberValue).toNumber(),
  z.number(),
);

export const leadOrderSchema = z.object({
  id: z.string(),
  display_id: z.coerce.number(),
  currency_code: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  items: z.array(
    z
      .object({
        title: z.string(),
        unit_price: amount,
        detail: z.object({ quantity: amount }),
      })
      .transform(({ detail, ...item }) => ({ ...item, ...detail })),
  ),
});

export type LeadOrder = z.infer<typeof leadOrderSchema>;

export function orderLeadForm(order: LeadOrder): URLSearchParams {
  const contact = checkoutContactSchema.parse(order.metadata ?? {});
  const currency = order.currency_code.toUpperCase();
  const money = (amount: number) => `${amount} ${currency}`;
  const total = order.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );
  const comment = [
    `Заказ #${order.display_id}, самовывоз, оплата при получении`,
    ...order.items.map(
      (item) =>
        `${item.title} × ${item.quantity}: ${money(item.unit_price * item.quantity)}`,
    ),
    `Итого: ${money(total)}`,
    ...(contact.comment ? [contact.comment] : []),
  ].join('\n');
  return new URLSearchParams({
    contact: contact.contact,
    contact_channel: contact.contact_channel ?? '',
    name: contact.name ?? '',
    vin: contact.vin ?? '',
    locale: contact.locale ?? '',
    comment,
    service: PARTS_ORDER_SERVICE,
    consent: '1',
  });
}

export async function sendOrderLead(
  url: string,
  form: URLSearchParams,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    body: form,
    redirect: 'manual',
    signal: AbortSignal.timeout(LEAD_ROUTE_TIMEOUT_MS),
  });
  await response.body?.cancel();
  if (response.status >= 400) {
    throw new Error(`The lead route answered ${response.status}`);
  }
}
