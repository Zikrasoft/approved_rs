import type { PartOffer } from '@podbor/catalog-contract';
import { isBuyable } from '@podbor/catalog-contract/availability';

export type BestPrice = {
  id: string;
  price: number;
  currency: string;
  startsFrom: boolean;
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
  const [picked] = (buyable.length ? buyable : offers).toSorted(
    (a, b) =>
      Number(inStock(b)) - Number(inStock(a)) ||
      a.price - b.price ||
      a.lead_time_days - b.lead_time_days,
  );
  return {
    id: picked.id,
    price: picked.price,
    currency: picked.currency,
    startsFrom:
      offers.length > 1 && offers.every(({ price }) => price >= picked.price),
    inStock: inStock(picked),
    buyable: buyable.length > 0,
    leadDays: picked.lead_time_days,
  };
}
