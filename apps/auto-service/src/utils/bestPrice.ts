import type { PartOffer } from '@podbor/catalog-contract';

export type BestPrice = { price: number; currency: string; inStock: boolean };

export function bestPrice(pages: { offers: PartOffer[] }[]): BestPrice | null {
  const offers = pages.flatMap(({ offers }) => offers);
  if (offers.length === 0) {
    return null;
  }
  const inStock = offers.filter(({ stock_quantity }) => stock_quantity > 0);
  const cheapest = (inStock.length ? inStock : offers).reduce((best, offer) =>
    offer.price < best.price ? offer : best,
  );
  return {
    price: cheapest.price,
    currency: cheapest.currency,
    inStock: inStock.length > 0,
  };
}
