import type { PartOffer } from '@podbor/catalog-contract';
import { compareOffers } from '@podbor/catalog-contract/availability';

export const SHOP_CURRENCY = 'RSD';

export const inShopCurrency = ({ currency }: { currency: string }): boolean =>
  currency.toUpperCase() === SHOP_CURRENCY;

export const sellPrice = (
  costPrice: number,
  markupPercentage: number,
): number =>
  Math.round(
    (Math.round(costPrice * 100) *
      (10_000 + Math.round(markupPercentage * 100))) /
      1_000_000,
  );

type PricedRow = {
  cost_price: number;
  currency: string;
  supplier: { markup_percentage: number };
};

export type PricedOfferRow = PricedRow & {
  id: string;
  stock_quantity: number;
  lead_time_days: number;
};

export const isSellable = (row: PricedRow): boolean =>
  inShopCurrency(row) &&
  sellPrice(row.cost_price, row.supplier.markup_percentage) > 0;

export const storeOffer = (row: PricedOfferRow): PartOffer | null =>
  isSellable(row)
    ? {
        id: row.id,
        price: sellPrice(row.cost_price, row.supplier.markup_percentage),
        currency: row.currency,
        stock_quantity: row.stock_quantity,
        lead_time_days: row.lead_time_days,
      }
    : null;

export const storeOffers = (rows: PricedOfferRow[]): PartOffer[] =>
  rows.flatMap((row) => storeOffer(row) ?? []).sort(compareOffers);

export const offersByIdentifier = (
  rows: (PricedOfferRow & { part_identifier_id: string })[],
): Map<string, PartOffer[]> => {
  const grouped = new Map<string, PricedOfferRow[]>();
  for (const row of rows) {
    grouped.set(row.part_identifier_id, [
      ...(grouped.get(row.part_identifier_id) ?? []),
      row,
    ]);
  }
  return new Map([...grouped].map(([id, offers]) => [id, storeOffers(offers)]));
};
