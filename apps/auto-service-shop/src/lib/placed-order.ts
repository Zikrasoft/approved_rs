import {
  listedPartOf,
  orderTotal,
  readLine,
  withAddonsUnderParts,
} from './line-metadata';
import type { LeadOrder } from './order-lead';
import { readOrder } from './order-metadata';

export function readPlacedOrder(order: LeadOrder) {
  return {
    contact: readOrder(order.metadata).contact,
    lines: withAddonsUnderParts(order.items).map((item) => {
      const line = readLine(item.metadata);
      return {
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.unit_price * item.quantity,
        addon: Boolean(line.addonKind),
        part: listedPartOf(item.metadata, item.title),
        inStock: line.inStock,
        leadTimeDays: line.leadTimeDays,
        supplier: line.supplier,
      };
    }),
    total: orderTotal(order.items),
  };
}

export type PlacedOrder = ReturnType<typeof readPlacedOrder>;
