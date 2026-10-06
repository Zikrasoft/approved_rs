export const ORDER_MARKER_PREFIX = 'shop-orders/';

export interface OrderMarkers {
  has(orderId: string): Promise<boolean>;
  add(orderId: string): Promise<void>;
  release(orderId: string): Promise<void>;
}

export const markerPath = (orderId: string): string =>
  `${ORDER_MARKER_PREFIX}${encodeURIComponent(orderId)}.json`;

export const markerBody = (orderId: string): string =>
  JSON.stringify({ orderId, at: new Date().toISOString() });
