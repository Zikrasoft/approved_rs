import type {
  BigNumberValue,
  MedusaContainer,
} from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MathBN } from '@medusajs/framework/utils';
import { fitComment } from '@podbor/catalog-contract';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import {
  orderLineText,
  orderMoney,
  PARTS_ORDER_COPY,
} from '@podbor/lead-crm/parts-order-copy';
import {
  SHOP_ORDERS_PATH,
  type OrderLead,
  type ShopOrderEvent,
} from '@podbor/lead-crm/shop-orders-wire';
import { z } from 'zod';

import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';
import { MANUAL_SUPPLIER } from './suppliers/manual-offers';
import { parseEnv } from './env';
import { readPlacedOrder } from './placed-order';

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
  supplier_names: z.record(z.string(), z.string()).optional(),
});

export type LeadOrder = z.infer<typeof leadOrderSchema>;

export function orderLeadPayload(
  order: LeadOrder,
  adminOrigin: string,
): OrderLead {
  const { contact, lines, total } = readPlacedOrder(order);
  if (!contact) {
    throw new Error(`Order ${order.id} has no contact`);
  }
  const currency = order.currency_code;
  const summary = fitComment({
    head: [
      PARTS_ORDER_COPY.heading(order.display_id),
      PARTS_ORDER_COPY.confirm,
      contact.car ?? '',
    ],
    lines: lines.map((line) =>
      orderLineText(
        {
          ...line,
          source:
            line.supplier === MANUAL_SUPPLIER
              ? PARTS_ORDER_COPY.manualOffer
              : line.supplier &&
                (order.supplier_names?.[line.supplier] ?? line.supplier),
        },
        currency,
      ),
    ),
    tail: [PARTS_ORDER_COPY.total(orderMoney(total, currency))],
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

export async function sendShopOrderEvent(
  storefrontOrigin: string,
  event: ShopOrderEvent,
  secret: string,
): Promise<void> {
  const response = await fetch(new URL(SHOP_ORDERS_PATH, storefrontOrigin), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(LEAD_ROUTE_TIMEOUT_MS),
  });
  await response.body?.cancel();
  if (!response.ok) throw new LeadRouteRefusal(response.status);
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
  const order = leadOrderSchema.parse(row);
  const keys = [
    ...new Set(
      readPlacedOrder(order).lines.flatMap(({ supplier }) => supplier ?? []),
    ),
  ];
  const suppliers: SupplierModuleService = container.resolve(SUPPLIER_MODULE);
  const named = keys.length
    ? await suppliers.listSuppliers({ key: keys }, { select: ['key', 'name'] })
    : [];
  return {
    ...order,
    supplier_names: Object.fromEntries(
      named.map(({ key, name }) => [key, name]),
    ),
  };
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
