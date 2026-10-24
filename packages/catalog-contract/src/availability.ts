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
