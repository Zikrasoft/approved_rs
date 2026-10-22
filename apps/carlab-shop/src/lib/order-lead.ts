import type { BigNumberValue } from '@medusajs/framework/types';
import { MathBN } from '@medusajs/framework/utils';
import { PARTS_ORDER_SERVICE } from '@podbor/brands';
import {
  checkoutContactSchema,
  fitComment,
  type Vehicle,
} from '@podbor/catalog-contract';
import { AD_SOURCE_FIELD, META_IDS_FIELD } from '@podbor/lead-crm/fields';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import { z } from 'zod';

import { ADDON_FOR_METADATA_KEY } from './offer-cart';

const LEAD_ROUTE_TIMEOUT_MS = 15_000;

export const LEAD_HANDOFF_ERROR = 'lead_handoff_error';

const OWNER_COPY = {
  heading: (displayId: number) =>
    `Заказ #${displayId}, самовывоз, оплата при получении`,
  confirm: 'Нужно подтвердить наличие и время самовывоза',
  line: (title: string, quantity: number, sum: string) =>
    `${title} × ${quantity}: ${sum}`,
  addon: (title: string, sum: string) => `+ ${title}: ${sum}`,
  total: (sum: string) => `Итого: ${sum}`,
  leftOut: (count: number) => `Не поместилось позиций: ${count}`,
};

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
        metadata: z.record(z.string(), z.unknown()).nullish(),
        detail: z.object({ quantity: amount }),
      })
      .transform(({ detail, ...item }) => ({ ...item, ...detail })),
  ),
});

export type LeadOrder = z.infer<typeof leadOrderSchema>;

export const carLabel = ({ model, engine }: Vehicle): string =>
  `${model.chassis.series.make.name} ${model.chassis.series.name} ${model.chassis.code} ${model.name}, ${engine.code}`;

export function orderLeadForm(order: LeadOrder): URLSearchParams {
  const contact = checkoutContactSchema.parse(order.metadata ?? {});
  const currency = order.currency_code.toUpperCase();
  const money = (amount: number) =>
    `${amount.toLocaleString('ru-RU')} ${currency}`;
  const total = order.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );
  const comment = fitComment({
    head: [
      OWNER_COPY.heading(order.display_id),
      OWNER_COPY.confirm,
      contact.car ?? '',
    ],
    lines: order.items.map((item) =>
      item.metadata?.[ADDON_FOR_METADATA_KEY]
        ? OWNER_COPY.addon(item.title, money(item.unit_price * item.quantity))
        : OWNER_COPY.line(
            item.title,
            item.quantity,
            money(item.unit_price * item.quantity),
          ),
    ),
    tail: [OWNER_COPY.total(money(total)), contact.comment ?? ''],
    limit: MAX_COMMENT_LENGTH,
    more: OWNER_COPY.leftOut,
  });
  return new URLSearchParams({
    contact: contact.contact,
    contact_channel: contact.contact_channel ?? '',
    name: contact.name ?? '',
    vin: contact.vin ?? '',
    locale: contact.locale ?? '',
    comment,
    service: PARTS_ORDER_SERVICE,
    consent: '1',
    source_url: contact.source_url ?? '',
    visitor_id: contact.visitor_id ?? '',
    [AD_SOURCE_FIELD]: contact[AD_SOURCE_FIELD] ?? '',
    [META_IDS_FIELD]: contact[META_IDS_FIELD] ?? '',
  });
}

export async function sendOrderLead(
  url: string,
  form: URLSearchParams,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { origin: new URL(url).origin },
    body: form,
    redirect: 'manual',
    signal: AbortSignal.timeout(LEAD_ROUTE_TIMEOUT_MS),
  });
  await response.body?.cancel();
  if (response.status >= 400) {
    throw new Error(`The lead route answered ${response.status}`);
  }
}
