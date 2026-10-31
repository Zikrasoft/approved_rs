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

export type PricedOfferRow = {
  id: string;
  cost_price: number;
  currency: string;
  stock_quantity: number;
  lead_time_days: number;
  supplier: { markup_percentage: number };
};

export const storeOffers = (rows: PricedOfferRow[]): PartOffer[] =>
  rows
    .filter(inShopCurrency)
    .map(
      ({
        id,
        cost_price,
        currency,
        stock_quantity,
        lead_time_days,
        supplier,
      }) => ({
        id,
        price: sellPrice(cost_price, supplier.markup_percentage),
        currency,
        stock_quantity,
        lead_time_days,
      }),
    )
    .filter(({ price }) => price > 0)
    .sort(compareOffers);
