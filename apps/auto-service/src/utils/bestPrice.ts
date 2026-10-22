import type { PartOffer } from '@podbor/catalog-contract';
import { isBuyable } from '@podbor/catalog-contract/availability';

export type BestPrice = {
  price: number;
  currency: string;
  inStock: boolean;
  buyable: boolean;
  leadDays: number;
};

export function bestPrice(pages: { offers: PartOffer[] }[]): BestPrice | null {
  const offers = pages.flatMap(({ offers }) => offers);
  if (offers.length === 0) {
    return null;
  }
  const inStock = offers.filter(({ stock_quantity }) => stock_quantity > 0);
  const buyable = offers.filter(isBuyable);
  const pool = inStock.length ? inStock : buyable.length ? buyable : offers;
  const cheapest = pool.reduce((best, offer) =>
    offer.price < best.price ? offer : best,
  );
  return {
    price: cheapest.price,
    currency: cheapest.currency,
    inStock: inStock.length > 0,
    buyable: buyable.length > 0,
    leadDays: cheapest.lead_time_days,
  };
}
