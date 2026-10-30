import type {
  BigNumberValue,
  MedusaContainer,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MathBN,
  Modules,
} from '@medusajs/framework/utils';
import { PARTS_ORDER_SERVICE } from '@podbor/brands';
import {
  checkoutContactSchema,
  fitComment,
  type Vehicle,
} from '@podbor/catalog-contract';
import {
  AD_SOURCE_FIELD,
  META_IDS_FIELD,
  ORDER_CANCELED,
  ORDER_ID_FIELD,
  ORDER_OUTCOME_FIELD,
} from '@podbor/lead-crm/fields';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';
import { z } from 'zod';

import { parseEnv } from './env';
import { filled, readLine, withAddonsUnderParts } from './line-metadata';
import { errorMessage } from './errors';

const LEAD_ROUTE_TIMEOUT_MS = 15_000;

export const LEAD_HANDOFF_ERROR = 'lead_handoff_error';
export const LEAD_HANDED_OFF_AT = 'lead_handed_off_at';
export const LEAD_HANDOFF_ATTEMPTS = 'lead_handoff_attempts';
export const LEAD_HANDOFF_MAX_ATTEMPTS = 6;
export const LEAD_OWNER_ALERTED_AT = 'lead_owner_alerted_at';
export const LEAD_LOST_AT = 'lead_lost_at';
export const LEAD_LOST_ERROR = 'lead_lost_error';
export const LEAD_CANCEL_REFUSED_AT = 'lead_cancel_refused_at';

type Metadata = Record<string, unknown> | null | undefined;

const attemptsSchema = z.coerce.number().int().nonnegative().catch(0);

export const handOffAttempts = (metadata: Metadata): number =>
  attemptsSchema.parse(metadata?.[LEAD_HANDOFF_ATTEMPTS] ?? 0);

export const leadHandoff = (metadata: Metadata) => {
  const attempts = handOffAttempts(metadata);
  return {
    handed_off_at: filled.parse(metadata?.[LEAD_HANDED_OFF_AT]),
    attempts,
    error: filled.parse(metadata?.[LEAD_HANDOFF_ERROR]),
    gave_up: attempts >= LEAD_HANDOFF_MAX_ATTEMPTS,
    alerted_at: filled.parse(metadata?.[LEAD_OWNER_ALERTED_AT]),
  };
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

const withReadiness = (
  text: string,
  metadata: Record<string, unknown> | null | undefined,
) => {
  const { inStock, leadTimeDays } = readLine(metadata);
  if (inStock === null || leadTimeDays === null) return text;
  const readiness = [
    inStock && PARTS_ORDER_COPY.inStock,
    leadTimeDays > 0 && PARTS_ORDER_COPY.pickupIn(leadTimeDays),
  ]
    .filter(Boolean)
    .join(', ');
  return readiness ? `${text}, ${readiness}` : text;
};

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
      PARTS_ORDER_COPY.heading(order.display_id),
      PARTS_ORDER_COPY.confirm,
      contact.car ?? '',
    ],
    lines: withAddonsUnderParts(order.items).map((item) =>
      readLine(item.metadata).addonKind
        ? PARTS_ORDER_COPY.addon(
            item.title,
            item.unit_price === 0
              ? PARTS_ORDER_COPY.free
              : money(item.unit_price * item.quantity),
          )
        : withReadiness(
            PARTS_ORDER_COPY.line(
              item.title,
              item.quantity,
              money(item.unit_price * item.quantity),
            ),
            item.metadata,
          ),
    ),
    tail: [PARTS_ORDER_COPY.total(money(total))],
    note: contact.comment ?? '',
    limit: MAX_COMMENT_LENGTH,
    more: PARTS_ORDER_COPY.leftOut,
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
    [ORDER_ID_FIELD]: order.id,
  });
}

class LeadRouteRefusal extends Error {
  status: number;

  constructor(status: number) {
    super(`The lead route answered ${status}`);
    this.status = status;
  }
}

export async function sendOrderLead(
  url: string,
  form: URLSearchParams,
  secret?: string,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      origin: new URL(url).origin,
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: form,
    redirect: 'manual',
    signal: AbortSignal.timeout(LEAD_ROUTE_TIMEOUT_MS),
  });
  await response.body?.cancel();
  if (response.status >= 400) {
    throw new LeadRouteRefusal(response.status);
  }
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

async function recordHandOff(
  container: MedusaContainer,
  id: string,
  outcome: (metadata: Record<string, unknown>) => Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const orders = container.resolve(Modules.ORDER);
  const { metadata } = await orders.retrieveOrder(id);
  const next = { ...metadata, ...outcome(metadata ?? {}) };
  await orders.updateOrders(id, { metadata: next });
  return next;
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

export async function handOrderToLeadRoute(
  container: MedusaContainer,
  id: string,
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  let displayId: number | string = id;
  try {
    const { LEAD_ROUTE_URL } = parseEnv(process.env);
    if (!LEAD_ROUTE_URL) {
      throw new Error('LEAD_ROUTE_URL is not set');
    }
    const order = await readLeadOrder(container, id);
    displayId = order.display_id;
    await sendOrderLead(LEAD_ROUTE_URL, orderLeadForm(order));
    logger.info(`Order ${id} handed to the lead pipeline`);
    await recordHandOff(container, id, () => ({
      [LEAD_HANDED_OFF_AT]: new Date().toISOString(),
      [LEAD_HANDOFF_ERROR]: '',
      [LEAD_HANDOFF_ATTEMPTS]: '',
    }));
  } catch (error) {
    const reason = errorMessage(error);
    logger.error(`Order ${id} did not reach the lead pipeline: ${reason}`);
    const recorded = await recordHandOff(container, id, (metadata) => ({
      [LEAD_HANDOFF_ERROR]: reason,
      [LEAD_HANDOFF_ATTEMPTS]: handOffAttempts(metadata) + 1,
    }));
    if (handOffAttempts(recorded) < LEAD_HANDOFF_MAX_ATTEMPTS) return;
    const alerted = await alertOwner(
      PARTS_ORDER_COPY.undelivered(displayId, reason),
    );
    if (!alerted) {
      logger.error(`Order ${id} gave up on the lead pipeline, nobody alerted`);
      return;
    }
    await recordHandOff(container, id, () => ({
      [LEAD_OWNER_ALERTED_AT]: new Date().toISOString(),
    }));
  }
}

export async function handCancelToLeadRoute(
  container: MedusaContainer,
  id: string,
): Promise<void> {
  const { metadata } = await container.resolve(Modules.ORDER).retrieveOrder(id);
  if (
    !metadata?.[LEAD_HANDED_OFF_AT] ||
    metadata[LEAD_LOST_AT] ||
    metadata[LEAD_CANCEL_REFUSED_AT]
  )
    return;
  try {
    const { LEAD_ROUTE_URL, SHOP_LEAD_SECRET } = parseEnv(process.env);
    if (!LEAD_ROUTE_URL || !SHOP_LEAD_SECRET) {
      throw new Error('LEAD_ROUTE_URL or SHOP_LEAD_SECRET is not set');
    }
    await sendOrderLead(
      LEAD_ROUTE_URL,
      new URLSearchParams({
        [ORDER_ID_FIELD]: id,
        [ORDER_OUTCOME_FIELD]: ORDER_CANCELED,
      }),
      SHOP_LEAD_SECRET,
    );
    await recordHandOff(container, id, () => ({
      [LEAD_LOST_AT]: new Date().toISOString(),
      [LEAD_LOST_ERROR]: '',
    }));
  } catch (error) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    if (error instanceof LeadRouteRefusal && error.status === 409) {
      logger.warn(`Order ${id} is canceled, but its Lead is already won`);
      await recordHandOff(container, id, () => ({
        [LEAD_CANCEL_REFUSED_AT]: new Date().toISOString(),
      }));
      return;
    }
    const reason = errorMessage(error);
    logger.error(
      `Order ${id} cancel did not reach the lead pipeline: ${reason}`,
    );
    await recordHandOff(container, id, () => ({ [LEAD_LOST_ERROR]: reason }));
  }
}
