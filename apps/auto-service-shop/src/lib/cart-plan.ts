import type { BigNumberValue } from '@medusajs/framework/types';
import { MathBN } from '@medusajs/framework/utils';
import {
  ADDON_KINDS,
  orderCap,
  type AddonKind,
  type CheckoutRefusal,
  type LineAddon,
  type OfferCart,
  type PartOffer,
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

export type Quote = Pick<
  PartOffer,
  'price' | 'stock_quantity' | 'lead_time_days'
>;

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
    remove: { itemId: string; code: CartRefusal }[];
    update: {
      itemId: string;
      update: { unit_price: number; quantity?: number };
      code: CartRefusal;
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
): CartRefusal | null =>
  !quote
    ? 'OFFER_MISSING'
    : orderCap(quote) < Number(item.quantity)
      ? 'OFFER_OUT_OF_STOCK'
      : null;

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
  const quantities = new Map(
    offerLines.map(({ item, line }) => [line.offerId, Number(item.quantity)]),
  );
  const kept = new Map(
    addonLines.map(({ item, line }) => [
      addonKey(line.parentOfferId, line.addonKind),
      item,
    ]),
  );
  const plan: CartPlan = {
    lines: [],
    fixes: { remove: [], update: [] },
    stamps: [],
    refusal: null,
  };
  const refuse = (code: CartRefusal | null) => {
    plan.refusal ??= code;
  };
  const remove = (itemId: string, code: CartRefusal) => {
    plan.fixes.remove.push({ itemId, code });
    refuse(code);
  };
  const reprice = (
    itemId: string,
    update: CartPlan['fixes']['update'][number]['update'],
  ) => {
    const code = 'OFFER_PRICE_CHANGED';
    plan.fixes.update.push({ itemId, update, code });
    refuse(code);
  };
  for (const { item, line } of offerLines) {
    const offerId = line.offerId;
    const quote = offerId ? quotes.get(offerId) : undefined;
    const unsold = offerRefusal(item, quote);
    refuse(unsold);
    if (!offerId) {
      continue;
    }
    const quantity = Number(item.quantity);
    if (quote && !MathBN.eq(quote.price, item.unit_price)) {
      reprice(item.id, { unit_price: quote.price });
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
    const installation = prices?.installation ?? null;
    plan.lines.push({
      id: item.id,
      offer_id: offerId,
      quantity,
      unit_price: quote ? quote.price : Number(item.unit_price),
      available: unsold === null,
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
  for (const { item, line } of addonLines) {
    const parent = line.parentOfferId;
    const price = parent ? priceFor(addons.get(parent), line.addonKind!) : null;
    const quantity = parent ? quantities.get(parent) : undefined;
    if (parent === null || price === null || quantity === undefined) {
      remove(item.id, 'OFFER_MISSING');
    } else if (kept.get(addonKey(parent, line.addonKind)) !== item) {
      remove(item.id, 'OFFER_PRICE_CHANGED');
    } else if (
      !MathBN.eq(price, item.unit_price) ||
      Number(item.quantity) !== quantity
    ) {
      reprice(item.id, { unit_price: price, quantity });
    }
  }
  return plan;
}

export const checkoutRefusal = ({
  refusal,
  fixes,
}: CartPlan): CartRefusal | null =>
  refusal ?? fixes.remove[0]?.code ?? fixes.update[0]?.code ?? null;
