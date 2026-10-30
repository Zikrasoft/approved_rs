import type { BigNumberValue } from '@medusajs/framework/types';
import { MathBN } from '@medusajs/framework/utils';
import { orderCap, type CheckoutRefusal } from '@podbor/catalog-contract';

import {
  type AddonKind,
  INSTALLATION,
  readLine,
  withParentOffers,
} from './line-metadata';

export type JudgedItem = {
  id: string;
  quantity: BigNumberValue;
  unit_price: BigNumberValue;
  metadata?: Record<string, unknown> | null;
};

export type Quote = {
  unit_price: number;
  stock_quantity: number;
  lead_time_days: number;
};

export type AddonPrices = {
  service: { unit_price: number } | null;
  installation: number | null;
};

export type JudgedRefusal = Exclude<
  CheckoutRefusal,
  'CONTACT_MISSING' | 'CART_CHANGED'
>;

export type JudgedLine = { id: string; quantity: number; unit_price: number };

export const addonKey = (
  parentOfferId: string | null,
  kind: AddonKind | null,
) => `${parentOfferId}:${kind}`;

export const priceFor = (
  prices: AddonPrices | undefined,
  kind: AddonKind,
): number | null =>
  kind === INSTALLATION
    ? (prices?.installation ?? null)
    : (prices?.service?.unit_price ?? null);

const offerRefusal = (
  item: JudgedItem,
  quote: Quote | undefined,
): JudgedRefusal | null => {
  if (!quote) {
    return 'OFFER_MISSING';
  }
  if (orderCap(quote) < Number(item.quantity)) {
    return 'OFFER_OUT_OF_STOCK';
  }
  return MathBN.eq(quote.unit_price, item.unit_price)
    ? null
    : 'OFFER_PRICE_CHANGED';
};

export function judgeCheckout(
  items: JudgedItem[],
  quotes: Map<string, Quote>,
  addons: Map<string, AddonPrices>,
): { refusal: JudgedRefusal } | { lines: JudgedLine[] } {
  const read = withParentOffers(items).map((item) => ({
    item,
    line: readLine(item.metadata),
  }));
  const offerLines = read.filter(({ line }) => !line.addonKind);
  const addonLines = read.filter(({ line }) => line.addonKind);
  const quantities = new Map(
    offerLines.map(({ item, line }) => [line.offerId, Number(item.quantity)]),
  );
  const keys = addonLines.map(({ line }) =>
    addonKey(line.parentOfferId, line.addonKind),
  );
  const prices = new Map<string, number>();
  for (const { item, line } of offerLines) {
    const quote = line.offerId ? quotes.get(line.offerId) : undefined;
    const refusal = offerRefusal(item, quote);
    if (refusal) {
      return { refusal };
    }
    prices.set(item.id, quote!.unit_price);
  }
  for (const [index, { item, line }] of addonLines.entries()) {
    const parent = line.parentOfferId;
    const price = parent ? priceFor(addons.get(parent), line.addonKind!) : null;
    if (parent === null || price === null || !quantities.has(parent)) {
      return { refusal: 'OFFER_MISSING' };
    }
    if (
      keys.indexOf(keys[index]) !== index ||
      Number(item.quantity) !== quantities.get(parent) ||
      !MathBN.eq(price, item.unit_price)
    ) {
      return { refusal: 'OFFER_PRICE_CHANGED' };
    }
    prices.set(item.id, price);
  }
  return {
    lines: items.map((item) => ({
      id: item.id,
      quantity: Number(item.quantity),
      unit_price: prices.get(item.id)!,
    })),
  };
}
