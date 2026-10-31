import { CASH_AT_PICKUP_METADATA } from './commerce-defaults';
import type { LeadOrder } from './order-lead';
import { orderLeadStatus } from './order-lead-sync';
import { readPlacedOrder, type PlacedOrder } from './placed-order';

type Metadata = Record<string, unknown> | null | undefined;

export const isCashAtPickup = (metadata: Metadata) =>
  metadata?.fulfillment === CASH_AT_PICKUP_METADATA.fulfillment;

const customerOf = (contact: PlacedOrder['contact']) =>
  contact && {
    name: contact.name ?? null,
    contact: contact.contact,
    contact_channel: contact.contact_channel ?? null,
    vin: contact.vin ?? null,
    car: contact.car ?? null,
    comment: contact.comment ?? null,
  };

export function carlabOrderView(order: LeadOrder) {
  const placed = readPlacedOrder(order);
  return {
    id: order.id,
    display_id: order.display_id,
    currency: order.currency_code.toUpperCase(),
    cash_at_pickup: isCashAtPickup(order.metadata),
    customer: customerOf(placed.contact),
    lines: placed.lines.map((line) => ({
      title: line.title,
      quantity: line.quantity,
      total: line.total,
      addon: line.addon,
      in_stock: line.inStock,
      lead_time_days: line.leadTimeDays,
    })),
    total: placed.total,
    lead: orderLeadStatus(order.metadata),
  };
}

export type CarlabOrderView = ReturnType<typeof carlabOrderView>;
