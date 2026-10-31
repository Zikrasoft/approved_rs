import { checkoutContactSchema } from '@podbor/catalog-contract';
import { CASH_AT_PICKUP_METADATA } from './commerce-defaults';
import { orderTotal, readLine, withAddonsUnderParts } from './line-metadata';
import type { LeadOrder } from './order-lead';
import { orderLeadStatus } from './order-lead-sync';

type Metadata = Record<string, unknown> | null | undefined;

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
  const lines = withAddonsUnderParts(order.items).map((item) => {
    const line = readLine(item.metadata);
    return {
      title: item.title,
      quantity: item.quantity,
      total: item.unit_price * item.quantity,
      addon: Boolean(line.addonKind),
      in_stock: line.inStock,
      lead_time_days: line.leadTimeDays,
    };
  });
  return {
    id: order.id,
    display_id: order.display_id,
    currency: order.currency_code.toUpperCase(),
    cash_at_pickup: isCashAtPickup(order.metadata),
    customer: customerOf(order.metadata),
    lines,
    total: orderTotal(order.items),
    lead: orderLeadStatus(order.metadata),
  };
}

export type CarlabOrderView = ReturnType<typeof carlabOrderView>;
