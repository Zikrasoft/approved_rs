import { checkoutContactSchema } from '@podbor/catalog-contract';

import {
  listedPartOf,
  orderTotal,
  readLine,
  withAddonsUnderParts,
} from './line-metadata';
import type { LeadOrder } from './order-lead';

export function readPlacedOrder(order: LeadOrder) {
  const contact = checkoutContactSchema.safeParse(order.metadata ?? {});
  return {
    contact: contact.success ? contact.data : null,
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
