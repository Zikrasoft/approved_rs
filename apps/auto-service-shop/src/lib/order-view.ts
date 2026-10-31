import type { LeadOrder } from './order-lead';
import { readOrder } from './order-metadata';
import { readPlacedOrder, type PlacedOrder } from './placed-order';

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
  const { cashAtPickup, lead } = readOrder(order.metadata);
  return {
    id: order.id,
    display_id: order.display_id,
    currency: order.currency_code.toUpperCase(),
    cash_at_pickup: cashAtPickup,
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
    lead,
  };
}

export type CarlabOrderView = ReturnType<typeof carlabOrderView>;
