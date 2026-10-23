import { checkoutContactSchema } from '@podbor/catalog-contract';
import { z } from 'zod';

import {
  CASH_AT_PICKUP_METADATA,
  ADDON_FOR_METADATA_KEY,
  IN_STOCK_METADATA_KEY,
  LEAD_TIME_METADATA_KEY,
} from './offer-cart';
import {
  handOffAttempts,
  LEAD_HANDED_OFF_AT,
  LEAD_HANDOFF_ERROR,
  LEAD_HANDOFF_MAX_ATTEMPTS,
  LEAD_OWNER_ALERTED_AT,
  type LeadOrder,
} from './order-lead';

type Metadata = Record<string, unknown> | null | undefined;

const filled = z
  .string()
  .min(1)
  .nullish()
  .catch(null)
  .transform((value) => value ?? null);

const readinessSchema = z.object({
  in_stock: z
    .boolean()
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  lead_time_days: z
    .number()
    .int()
    .nonnegative()
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
});

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

export const isCashAtPickup = (metadata: Metadata) =>
  metadata?.fulfillment === CASH_AT_PICKUP_METADATA.fulfillment;

const customerOf = (metadata: Metadata) => {
  const contact = checkoutContactSchema.safeParse(metadata ?? {});
  if (!contact.success) {
    return null;
  }
  const {
    name,
    contact: reach,
    contact_channel,
    vin,
    car,
    comment,
  } = contact.data;
  return {
    name: name ?? null,
    contact: reach,
    contact_channel: contact_channel ?? null,
    vin: vin ?? null,
    car: car ?? null,
    comment: comment ?? null,
  };
};

export function carlabOrderView(order: LeadOrder) {
  const lines = order.items.map((item) => ({
    title: item.title,
    quantity: item.quantity,
    total: item.unit_price * item.quantity,
    addon: Boolean(item.metadata?.[ADDON_FOR_METADATA_KEY]),
    ...readinessSchema.parse({
      in_stock: item.metadata?.[IN_STOCK_METADATA_KEY],
      lead_time_days: item.metadata?.[LEAD_TIME_METADATA_KEY],
    }),
  }));
  return {
    id: order.id,
    display_id: order.display_id,
    currency: order.currency_code.toUpperCase(),
    cash_at_pickup: isCashAtPickup(order.metadata),
    customer: customerOf(order.metadata),
    lines,
    total: lines.reduce((sum, line) => sum + line.total, 0),
    lead: leadHandoff(order.metadata),
  };
}

export type CarlabOrderView = ReturnType<typeof carlabOrderView>;
