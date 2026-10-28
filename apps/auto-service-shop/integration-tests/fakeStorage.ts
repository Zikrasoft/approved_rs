import type { Bucket, ShopStorage } from '../src/lib/storage';

type StoredObject = {
  body: Buffer;
  contentType: string;
  metadata: Record<string, string>;
};

export const memoryBucket = () => {
  const objects = new Map<string, StoredObject>();
  const bucket: Bucket = {
    put: async (key, body, { contentType, metadata = {} }) => {
      objects.set(key, { body, contentType, metadata });
    },
    get: async (key) => objects.get(key)?.body ?? null,
    has: async (key) => objects.has(key),
  };
  return { bucket, objects };
};

export const memoryStorage = (publicUrl = 'https://files.carlab.test') => {
  const pages = memoryBucket();
  const images = memoryBucket();
  const storage: ShopStorage = {
    pages: pages.bucket,
    images: images.bucket,
    publicUrl: (key) => `${publicUrl}/${key}`,
  };
  return { storage, pages, images };
};
