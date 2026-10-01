import { BlobNotFoundError, head, put } from '@vercel/blob';
import { LOCAL_DATA_DIR } from './localDataDir';

export const ORDER_MARKER_PREFIX = 'shop-orders/';

export interface OrderMarkers {
  has(orderId: string): Promise<boolean>;
  add(orderId: string): Promise<void>;
}

export const markerPath = (orderId: string): string =>
  `${ORDER_MARKER_PREFIX}${encodeURIComponent(orderId)}.json`;

const marker = (orderId: string): string =>
  JSON.stringify({ orderId, at: new Date().toISOString() });

export const blobOrderMarkers: OrderMarkers = {
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
    await put(markerPath(orderId), marker(orderId), {
      access: 'private',
      allowOverwrite: false,
      addRandomSuffix: false,
      contentType: 'application/json',
    });
  },
};

function selectOrderMarkers(): OrderMarkers {
  if (import.meta.env.DEV) {
    const localPath = (orderId: string) =>
      `${LOCAL_DATA_DIR}/${markerPath(orderId)}`;
    return {
      async has(orderId) {
        const { access } = await import('node:fs/promises');
        try {
          await access(localPath(orderId));
          return true;
        } catch {
          return false;
        }
      },

      async add(orderId) {
        const { mkdir, writeFile } = await import('node:fs/promises');
        await mkdir(`${LOCAL_DATA_DIR}/${ORDER_MARKER_PREFIX}`, {
          recursive: true,
        });
        await writeFile(localPath(orderId), marker(orderId), { flag: 'wx' });
      },
    };
  }
  return blobOrderMarkers;
}

export const orderMarkers: OrderMarkers = selectOrderMarkers();
