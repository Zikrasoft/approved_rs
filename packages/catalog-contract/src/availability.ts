export type OfferAvailability = {
  stock_quantity: number;
  lead_time_days: number;
};

export const LEAD_TIME_ORDER_CAP = 10;

export const orderCap = ({
  stock_quantity,
  lead_time_days,
}: OfferAvailability): number =>
  lead_time_days > 0
    ? Math.max(stock_quantity, LEAD_TIME_ORDER_CAP)
    : stock_quantity;

export const isBuyable = (offer: OfferAvailability): boolean =>
  orderCap(offer) > 0;

export type RankableOffer = OfferAvailability & {
  price: number;
  currency: string;
};

const inStock = (offer: OfferAvailability) => Number(offer.stock_quantity > 0);

const wait = (offer: OfferAvailability) =>
  isBuyable(offer) ? offer.lead_time_days : Infinity;

export const compareOffers = (a: RankableOffer, b: RankableOffer): number =>
  Number(isBuyable(b)) - Number(isBuyable(a)) ||
  inStock(b) - inStock(a) ||
  a.price - b.price ||
  a.lead_time_days - b.lead_time_days;

const noWorse = (a: RankableOffer, b: RankableOffer) =>
  a.currency === b.currency &&
  a.price <= b.price &&
  wait(a) <= wait(b) &&
  inStock(a) >= inStock(b);

export const rankOffers = <Offer extends RankableOffer>(
  offers: Offer[],
): Offer[] =>
  offers
    .filter(
      (offer, index) =>
        !offers.some(
          (other, otherIndex) =>
            otherIndex !== index &&
            noWorse(other, offer) &&
            (otherIndex < index || !noWorse(offer, other)),
        ),
    )
    .sort(compareOffers);

export const bestOffer = <Offer extends RankableOffer>(
  offers: Offer[],
): Offer | null => [...offers].sort(compareOffers)[0] ?? null;
