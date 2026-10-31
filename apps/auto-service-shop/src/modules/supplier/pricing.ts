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

const sellingRows = <Row extends PricedOfferRow>(
  rows: Row[],
): (Row & { price: number })[] =>
  rows
    .filter(isSellable)
    .map((row) => ({
      ...row,
      price: sellPrice(row.cost_price, row.supplier.markup_percentage),
    }))
    .sort(compareOffers);

export const storeOffers = (rows: PricedOfferRow[]): PartOffer[] =>
  sellingRows(rows).map(
    ({ id, price, currency, stock_quantity, lead_time_days }) => ({
      id,
      price,
      currency,
      stock_quantity,
      lead_time_days,
    }),
  );
