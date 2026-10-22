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
import { AD_SOURCE_FIELD, META_IDS_FIELD } from '@podbor/lead-crm/fields';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import { z } from 'zod';

import { parseEnv } from './env';
import { ADDON_FOR_METADATA_KEY } from './offer-cart';

const LEAD_ROUTE_TIMEOUT_MS = 15_000;

export const LEAD_HANDOFF_ERROR = 'lead_handoff_error';
export const LEAD_HANDOFF_ATTEMPTS = 'lead_handoff_attempts';
export const LEAD_HANDOFF_MAX_ATTEMPTS = 6;

const attemptsSchema = z.coerce.number().int().nonnegative().catch(0);

export const handOffAttempts = (
  metadata: Record<string, unknown> | null | undefined,
): number => attemptsSchema.parse(metadata?.[LEAD_HANDOFF_ATTEMPTS] ?? 0);

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

const isTimeout = (error: unknown) =>
  error instanceof Error && error.name === 'TimeoutError';

async function readLeadOrder(
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
): Promise<void> {
  const orders = container.resolve(Modules.ORDER);
  const { metadata } = await orders.retrieveOrder(id);
  await orders.updateOrders(id, {
    metadata: { ...metadata, ...outcome(metadata ?? {}) },
  });
}

export async function handOrderToLeadRoute(
  container: MedusaContainer,
  id: string,
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const { LEAD_ROUTE_URL } = parseEnv(process.env);
    if (!LEAD_ROUTE_URL) {
      throw new Error('LEAD_ROUTE_URL is not set');
    }
    const order = await readLeadOrder(container, id);
    await sendOrderLead(LEAD_ROUTE_URL, orderLeadForm(order));
    logger.info(`Order ${id} handed to the lead pipeline`);
    if (order.metadata?.[LEAD_HANDOFF_ERROR]) {
      await recordHandOff(container, id, () => ({
        [LEAD_HANDOFF_ERROR]: '',
        [LEAD_HANDOFF_ATTEMPTS]: '',
      }));
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error(`Order ${id} did not reach the lead pipeline: ${reason}`);
    await recordHandOff(container, id, (metadata) => ({
      [LEAD_HANDOFF_ERROR]: reason,
      [LEAD_HANDOFF_ATTEMPTS]: isTimeout(error)
        ? LEAD_HANDOFF_MAX_ATTEMPTS
        : handOffAttempts(metadata) + 1,
    }));
  }
}
