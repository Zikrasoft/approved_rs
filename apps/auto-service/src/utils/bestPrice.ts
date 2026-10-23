import type { PartOffer } from '@podbor/catalog-contract';
import { isBuyable } from '@podbor/catalog-contract/availability';

export type BestPrice = {
  price: number;
  currency: string;
  inStock: boolean;
  buyable: boolean;
  leadDays: number;
};

const inStock = (offer: PartOffer) => offer.stock_quantity > 0;

export function bestPrice(pages: { offers: PartOffer[] }[]): BestPrice | null {
  const offers = pages.flatMap(({ offers }) => offers);
  if (offers.length === 0) {
    return null;
  }
  const buyable = offers.filter(isBuyable);
  const cheapest = (buyable.length ? buyable : offers).reduce((best, offer) =>
    offer.price < best.price ||
    (offer.price === best.price && inStock(offer) && !inStock(best))
      ? offer
      : best,
  );
  return {
    price: cheapest.price,
    currency: cheapest.currency,
    inStock: inStock(cheapest),
    buyable: buyable.length > 0,
    leadDays: cheapest.lead_time_days,
  };
}
