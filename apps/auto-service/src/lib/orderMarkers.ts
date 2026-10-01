import { BlobNotFoundError, head, put } from '@vercel/blob';
import { LOCAL_LEADS_DIR } from './localStorageDir';

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

const localPath = (orderId: string): string =>
  `${LOCAL_LEADS_DIR}/${markerPath(orderId)}`;

const fileOrderMarkers: OrderMarkers = {
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
    await mkdir(`${LOCAL_LEADS_DIR}/${ORDER_MARKER_PREFIX}`, {
      recursive: true,
    });
    await writeFile(localPath(orderId), marker(orderId), { flag: 'wx' });
  },
};

export const orderMarkers: OrderMarkers = import.meta.env.DEV
  ? fileOrderMarkers
  : blobOrderMarkers;
