import type { PartOffer } from '@podbor/catalog-contract';
import {
  isBuyable,
  rankOffers,
  type RankableOffer,
} from '@podbor/catalog-contract/availability';

export type BestPrice = {
  id: string;
  price: number;
  currency: string;
  startsFrom: boolean;
  inStock: boolean;
  buyable: boolean;
  leadDays: number;
};

export function offerSummary<Offer extends RankableOffer>(offers: Offer[]) {
  const [best = null, ...others] = rankOffers(offers);
  const cheaper =
    others
      .filter((offer) => isBuyable(offer) && best && offer.price < best.price)
      .sort((a, b) => a.price - b.price)[0] ?? null;
  return {
    best,
    others,
    cheaper,
    startsFrom:
      best !== null &&
      others.every(({ price }) => price >= best.price) &&
      others.some(({ price }) => price > best.price),
  };
}

export type MoreOffersCopy = { moreOffers: string; moreOffersCheaper: string };

export const moreOffersLabel = <Offer extends RankableOffer>(
  { others, cheaper }: { others: Offer[]; cheaper: Offer | null },
  copy: MoreOffersCopy,
  money: (offer: Offer) => string,
): string =>
  (cheaper
    ? copy.moreOffersCheaper.replace('{price}', money(cheaper))
    : copy.moreOffers
  ).replace('{count}', String(others.length));

export function bestPrice(pages: { offers: PartOffer[] }[]): BestPrice | null {
  const { best, startsFrom } = offerSummary(
    pages.flatMap(({ offers }) => offers),
  );
  if (!best) {
    return null;
  }
  return {
    id: best.id,
    price: best.price,
    currency: best.currency,
    startsFrom,
    inStock: best.stock_quantity > 0,
    buyable: isBuyable(best),
    leadDays: best.lead_time_days,
  };
}
