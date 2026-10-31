import type {
  BigNumberValue,
  MedusaContainer,
} from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MathBN } from '@medusajs/framework/utils';
import { PARTS_ORDER_SERVICE } from '@podbor/brands';
import { fitComment } from '@podbor/catalog-contract';
import {
  AD_SOURCE_FIELD,
  META_IDS_FIELD,
  ORDER_CANCELED,
  ORDER_ID_FIELD,
  ORDER_OUTCOME_FIELD,
} from '@podbor/lead-crm/fields';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';
import {
  SHOP_ORDERS_PATH,
  type OrderLead,
  type ShopOrderEvent,
} from '@podbor/lead-crm/shop-orders-wire';
import { z } from 'zod';

import { MANUAL_SOURCE } from '../modules/catalog/models/provenance';
import { parseEnv } from './env';
import { readPlacedOrder, type PlacedOrder } from './placed-order';

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
        metadata: z.record(z.string(), z.unknown()).nullish(),
        detail: z.object({ quantity: amount }),
      })
      .transform(({ detail, ...item }) => ({ ...item, ...detail })),
  ),
});

export type LeadOrder = z.infer<typeof leadOrderSchema>;

const withReadiness = (
  text: string,
  { inStock, leadTimeDays, supplier }: PlacedOrder['lines'][number],
) => {
  const readiness = [
    inStock && PARTS_ORDER_COPY.inStock,
    leadTimeDays && PARTS_ORDER_COPY.pickupIn(leadTimeDays),
    supplier === MANUAL_SOURCE ? PARTS_ORDER_COPY.manualOffer : supplier,
  ]
    .filter(Boolean)
    .join(', ');
  return readiness ? `${text}, ${readiness}` : text;
};

export function orderLeadPayload(
  order: LeadOrder,
  adminOrigin: string,
): OrderLead {
  const { contact, lines, total } = readPlacedOrder(order);
  if (!contact) {
    throw new Error(`Order ${order.id} has no contact`);
  }
  const currency = order.currency_code.toUpperCase();
  const money = (amount: number) =>
    `${amount.toLocaleString('ru-RU')} ${currency}`;
  const summary = fitComment({
    head: [
      PARTS_ORDER_COPY.heading(order.display_id),
      PARTS_ORDER_COPY.confirm,
      contact.car ?? '',
    ],
    lines: lines.map((line) =>
      line.addon
        ? PARTS_ORDER_COPY.addon(
            line.title,
            line.unitPrice === 0 ? PARTS_ORDER_COPY.free : money(line.total),
          )
        : withReadiness(
            PARTS_ORDER_COPY.line(line.title, line.quantity, money(line.total)),
            line,
          ),
    ),
    tail: [PARTS_ORDER_COPY.total(money(total))],
    note: contact.comment ?? '',
    limit: MAX_COMMENT_LENGTH,
    more: (count) =>
      PARTS_ORDER_COPY.leftOut(count, `${adminOrigin}/app/orders/${order.id}`),
  });
  return { event: 'placed', order_id: order.id, contact, summary };
}

export class LeadRouteRefusal extends Error {
  status: number;

  constructor(status: number) {
    super(`The lead route answered ${status}`);
    this.status = status;
  }
}

// TODO: drop the origin header and redirect: 'manual' with the /api/leads fallback below; only that form route needs them, for Astro's origin check and its redirect to /thanks/.
const post = (url: string | URL, body: BodyInit, secret: string) =>
  fetch(url, {
    method: 'POST',
    headers: {
      origin: new URL(url).origin,
      authorization: `Bearer ${secret}`,
      ...(typeof body === 'string'
        ? { 'content-type': 'application/json' }
        : {}),
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(LEAD_ROUTE_TIMEOUT_MS),
  });

const legacyForm = (event: ShopOrderEvent): URLSearchParams =>
  event.event === 'canceled'
    ? new URLSearchParams({
        [ORDER_ID_FIELD]: event.order_id,
        [ORDER_OUTCOME_FIELD]: ORDER_CANCELED,
      })
    : new URLSearchParams({
        contact: event.contact.contact,
        contact_channel: event.contact.contact_channel ?? '',
        name: event.contact.name ?? '',
        vin: event.contact.vin ?? '',
        locale: event.contact.locale ?? '',
        comment: event.summary,
        service: PARTS_ORDER_SERVICE,
        consent: '1',
        source_url: event.contact.source_url ?? '',
        visitor_id: event.contact.visitor_id ?? '',
        [AD_SOURCE_FIELD]: event.contact[AD_SOURCE_FIELD] ?? '',
        [META_IDS_FIELD]: event.contact[META_IDS_FIELD] ?? '',
        [ORDER_ID_FIELD]: event.order_id,
      });

export async function sendShopOrderEvent(
  leadRouteUrl: string,
  event: ShopOrderEvent,
  secret: string,
): Promise<void> {
  const response = await post(
    new URL(SHOP_ORDERS_PATH, leadRouteUrl),
    JSON.stringify(event),
    secret,
  );
  await response.body?.cancel();
  if (response.ok) return;
  if (response.status !== 404) throw new LeadRouteRefusal(response.status);
  // TODO: drop this /api/leads fallback, and read LEAD_ROUTE_URL as the storefront origin, one release after every storefront serves SHOP_ORDERS_PATH.
  const legacy = await post(leadRouteUrl, legacyForm(event), secret);
  await legacy.body?.cancel();
  if (legacy.status >= 400) throw new LeadRouteRefusal(legacy.status);
}

export async function readLeadOrder(
  container: MedusaContainer,
  id: string,
): Promise<LeadOrder> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [row],
  } = await query.graph({
    entity: 'order',
    filters: { id },
    fields: [
      'id',
      'display_id',
      'currency_code',
      'metadata',
      'items.title',
      'items.detail.quantity',
      'items.unit_price',
      'items.metadata',
    ],
  });
  return leadOrderSchema.parse(row);
}

const telegramReplySchema = z.object({ ok: z.literal(true) });

export async function alertOwner(
  text: string,
  apiRoot = 'https://api.telegram.org',
): Promise<boolean> {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_ID } = parseEnv(process.env);
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_GROUP_ID) return false;
  const response = await fetch(
    `${apiRoot}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_GROUP_ID, text }),
      signal: AbortSignal.timeout(LEAD_ROUTE_TIMEOUT_MS),
    },
  ).catch(() => undefined);
  const reply = await response?.json().catch(() => undefined);
  return telegramReplySchema.safeParse(reply).success;
}
