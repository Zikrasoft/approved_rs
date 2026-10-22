export type OfferAvailability = {
  stock_quantity: number;
  lead_time_days: number;
};

export const LEAD_TIME_ORDER_CAP = 10;

export const orderCap = ({
  stock_quantity,
  lead_time_days,
}: OfferAvailability): number =>
  stock_quantity > 0
    ? stock_quantity
    : lead_time_days > 0
      ? LEAD_TIME_ORDER_CAP
      : 0;

export const isBuyable = (offer: OfferAvailability): boolean =>
  orderCap(offer) > 0;
