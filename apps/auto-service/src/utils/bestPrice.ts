import type { PartOffer } from '@podbor/catalog-contract';
import {
  isBuyable,
  rankOffers,
  type RankableOffer,
} from '@podbor/catalog-contract/availability';
import {
  offerAvailability,
  plural,
  type LeadTimeCopy,
  type PluralForms,
} from './leadTime';

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

export type MoreOffersCopy = {
  moreOffers: string;
  moreOffersCheaper: string;
  moreOffersSeveral: PluralForms;
  leadTime: LeadTimeCopy;
};

const lowerFirst = (text: string, localeTag: string) =>
  text.charAt(0).toLocaleLowerCase(localeTag) + text.slice(1);

export function moreOffersLabel<Offer extends RankableOffer>(
  { others, cheaper }: { others: Offer[]; cheaper: Offer | null },
  copy: MoreOffersCopy,
  money: (offer: Offer) => string,
  localeTag: string,
): string {
  const [only, ...rest] = others;
  if (!only) return '';
  if (rest.length === 0) {
    const { stock, lead } = offerAvailability(only, copy.leadTime, localeTag);
    const when = stock ?? lead;
    return (cheaper ? copy.moreOffersCheaper : copy.moreOffers).replace(
      '{offer}',
      [money(only), when && lowerFirst(when, localeTag)]
        .filter(Boolean)
        .join(', '),
    );
  }
  const lowest = others.reduce((low, offer) =>
    offer.price < low.price ? offer : low,
  );
  return plural(others.length, copy.moreOffersSeveral, localeTag)
    .replace('{count}', String(others.length))
    .replace('{price}', money(lowest));
}

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
