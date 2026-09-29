import { BlobNotFoundError, head, put } from '@vercel/blob';

export const ORDER_MARKER_PREFIX = 'shop-orders/';

export interface OrderMarkers {
  has(orderId: string): Promise<boolean>;
  add(orderId: string): Promise<void>;
}

export const markerPath = (orderId: string): string =>
  `${ORDER_MARKER_PREFIX}${encodeURIComponent(orderId)}.json`;

export const orderMarkers: OrderMarkers = {
  async has(orderId) {
    try {
      await head(markerPath(orderId));
      return true;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return false;
      throw error;
    }
  },

  async add(orderId) {
    await put(
      markerPath(orderId),
      JSON.stringify({ orderId, at: new Date().toISOString() }),
      {
        access: 'private',
        allowOverwrite: false,
        addRandomSuffix: false,
        contentType: 'application/json',
      },
    );
  },
};
