import type { PartOffer } from '@podbor/catalog-contract';
import { bestOffer, isBuyable } from '@podbor/catalog-contract/availability';

export type BestPrice = {
  id: string;
  price: number;
  currency: string;
  startsFrom: boolean;
  inStock: boolean;
  buyable: boolean;
  leadDays: number;
};

export function bestPrice(pages: { offers: PartOffer[] }[]): BestPrice | null {
  const offers = pages.flatMap(({ offers }) => offers);
  const picked = bestOffer(offers);
  if (!picked) {
    return null;
  }
  return {
    id: picked.id,
    price: picked.price,
    currency: picked.currency,
    startsFrom:
      offers.length > 1 && offers.every(({ price }) => price >= picked.price),
    inStock: picked.stock_quantity > 0,
    buyable: isBuyable(picked),
    leadDays: picked.lead_time_days,
  };
}
