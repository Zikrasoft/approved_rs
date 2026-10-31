import type { PartOffer } from '@podbor/catalog-contract';
import { isBuyable } from '@podbor/catalog-contract/availability';

const wait = (offer: PartOffer) =>
  isBuyable(offer) ? offer.lead_time_days : Infinity;

const inStock = (offer: PartOffer) => Number(offer.stock_quantity > 0);

const noWorse = (a: PartOffer, b: PartOffer) =>
  a.currency === b.currency &&
  a.price <= b.price &&
  wait(a) <= wait(b) &&
  inStock(a) >= inStock(b);

export function rankOffers(offers: PartOffer[]): PartOffer[] {
  return offers
    .filter(
      (offer, index) =>
        !offers.some(
          (other, otherIndex) =>
            otherIndex !== index &&
            noWorse(other, offer) &&
            (otherIndex < index || !noWorse(offer, other)),
        ),
    )
    .toSorted(
      (a, b) =>
        Number(isBuyable(b)) - Number(isBuyable(a)) ||
        inStock(b) - inStock(a) ||
        a.price - b.price ||
        wait(a) - wait(b),
    );
}
