import type { BigNumberValue } from '@medusajs/framework/types';
import { MathBN } from '@medusajs/framework/utils';
import {
  ADDON_KINDS,
  orderCap,
  type AddonKind,
  type CheckoutRefusal,
  type LineAddon,
  type OfferCart,
} from '@podbor/catalog-contract';

import {
  listedPartOf,
  readinessMetadata,
  readLine,
  withParentOffers,
} from './line-metadata';

export type CartItem = {
  id: string;
  title?: string;
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
  service: Omit<LineAddon, 'item_id'> | null;
  installation: number | null;
};

export type CartRefusal = Exclude<
  CheckoutRefusal,
  'CONTACT_MISSING' | 'CART_CHANGED'
>;

export type CartPlan = {
  lines: OfferCart['items'];
  fixes: {
    remove: string[];
    update: {
      itemId: string;
      update: { unit_price: number; quantity?: number };
    }[];
  };
  stamps: { itemId: string; metadata: Record<string, unknown> }[];
  refusal: CartRefusal | null;
};

const addonKey = (parentOfferId: string | null, kind: AddonKind | null) =>
  `${parentOfferId}:${kind}`;

export const priceFor = (
  prices: AddonPrices | undefined,
  kind: AddonKind,
): number | null =>
  kind === 'installation'
    ? (prices?.installation ?? null)
    : (prices?.service?.unit_price ?? null);

const offerRefusal = (
  item: CartItem,
  quote: Quote | undefined,
): CartRefusal | null => {
  if (!quote || quote.unit_price <= 0) {
    return 'OFFER_MISSING';
  }
  if (orderCap(quote) < Number(item.quantity)) {
    return 'OFFER_OUT_OF_STOCK';
  }
  return MathBN.eq(quote.unit_price, item.unit_price)
    ? null
    : 'OFFER_PRICE_CHANGED';
};

type ReadItem = { item: CartItem; line: ReturnType<typeof readLine> };

const refusalOf = (
  offerLines: ReadItem[],
  addonLines: ReadItem[],
  quotes: Map<string, Quote>,
  addons: Map<string, AddonPrices>,
): CartRefusal | null => {
  for (const { item, line } of offerLines) {
    const refusal = offerRefusal(
      item,
      line.offerId ? quotes.get(line.offerId) : undefined,
    );
    if (refusal) {
      return refusal;
    }
  }
  const quantities = new Map(
    offerLines.map(({ item, line }) => [line.offerId, Number(item.quantity)]),
  );
  const keys = addonLines.map(({ line }) =>
    addonKey(line.parentOfferId, line.addonKind),
  );
  for (const [index, { item, line }] of addonLines.entries()) {
    const parent = line.parentOfferId;
    const price = parent ? priceFor(addons.get(parent), line.addonKind!) : null;
    if (parent === null || price === null || !quantities.has(parent)) {
      return 'OFFER_MISSING';
    }
    if (
      keys.indexOf(keys[index]) !== index ||
      Number(item.quantity) !== quantities.get(parent) ||
      !MathBN.eq(price, item.unit_price)
    ) {
      return 'OFFER_PRICE_CHANGED';
    }
  }
  return null;
};

export function planCart(
  items: CartItem[],
  quotes: Map<string, Quote>,
  addons: Map<string, AddonPrices>,
): CartPlan {
  const read = withParentOffers(items).map((item) => ({
    item,
    line: readLine(item.metadata),
  }));
  const offerLines = read.filter(({ line }) => !line.addonKind);
  const addonLines = read.filter(({ line }) => line.addonKind);
  const kept = new Map(
    addonLines.map(({ item, line }) => [
      addonKey(line.parentOfferId, line.addonKind),
      item,
    ]),
  );
  const plan: CartPlan = {
    lines: [],
    fixes: {
      remove: addonLines
        .filter(
          ({ item, line: { parentOfferId, addonKind } }) =>
            !parentOfferId ||
            priceFor(addons.get(parentOfferId), addonKind!) === null ||
            kept.get(addonKey(parentOfferId, addonKind)) !== item,
        )
        .map(({ item }) => item.id),
      update: [],
    },
    stamps: [],
    refusal: refusalOf(offerLines, addonLines, quotes, addons),
  };
  for (const { item, line } of offerLines) {
    const offerId = line.offerId;
    if (!offerId) {
      continue;
    }
    const quote = quotes.get(offerId);
    const quantity = Number(item.quantity);
    if (quote && !MathBN.eq(quote.unit_price, item.unit_price)) {
      plan.fixes.update.push({
        itemId: item.id,
        update: { unit_price: quote.unit_price },
      });
    }
    const readiness = quote
      ? readinessMetadata(quote.stock_quantity > 0, quote.lead_time_days)
      : readinessMetadata(false, 0);
    if (
      quote &&
      (line.inStock !== readiness.in_stock ||
        line.leadTimeDays !== readiness.lead_time_days)
    ) {
      plan.stamps.push({
        itemId: item.id,
        metadata: { ...item.metadata, ...readiness },
      });
    }
    const prices = addons.get(offerId);
    const added = (kind: AddonKind) =>
      priceFor(prices, kind) === null
        ? undefined
        : kept.get(addonKey(offerId, kind));
    for (const kind of ADDON_KINDS) {
      const addonLine = added(kind);
      const price = priceFor(prices, kind);
      if (
        addonLine &&
        price !== null &&
        (!MathBN.eq(price, addonLine.unit_price) ||
          Number(addonLine.quantity) !== quantity)
      ) {
        plan.fixes.update.push({
          itemId: addonLine.id,
          update: { unit_price: price, quantity },
        });
      }
    }
    const installation = prices?.installation ?? null;
    plan.lines.push({
      id: item.id,
      offer_id: offerId,
      quantity,
      unit_price: quote ? quote.unit_price : Number(item.unit_price),
      available: !!quote && orderCap(quote) >= quantity,
      max_quantity: quote ? orderCap(quote) : 0,
      ...readiness,
      addon: prices?.service
        ? { item_id: added('service')?.id ?? null, ...prices.service }
        : null,
      installation:
        installation === null
          ? null
          : {
              item_id: added('installation')?.id ?? null,
              unit_price: installation,
            },
      part: listedPartOf(item.metadata, item.title ?? ''),
    });
  }
  return plan;
}

export const checkoutRefusal = ({
  refusal,
  fixes,
}: CartPlan): CartRefusal | null =>
  refusal ??
  (fixes.remove.length || fixes.update.length ? 'OFFER_PRICE_CHANGED' : null);
