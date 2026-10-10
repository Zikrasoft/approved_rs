import {
  del,
  get,
  head,
  put,
  BlobNotFoundError,
  BlobPreconditionFailedError,
} from '@vercel/blob';
import { markerBody, markerPath, type OrderMarkers } from '../orderMarkers.ts';
import {
  StorageConflictError,
  type LeadStorage,
  type StorageSnapshot,
} from './types.ts';

export interface VercelBlobStorageOptions {
  path: string;
}

async function etagOf(path: string): Promise<string | undefined> {
  try {
    return (await head(path)).etag;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return undefined;
    throw error;
  }
}

const exists = async (path: string) => (await etagOf(path)) !== undefined;

export function createVercelBlobStorage({
  path,
}: VercelBlobStorageOptions): LeadStorage {
  return {
    exists: () => exists(path),

    async read(): Promise<StorageSnapshot> {
      const version = await etagOf(path);
      if (version === undefined) return { raw: undefined, version };
      const result = await get(path, { access: 'private', useCache: false });
      if (!result) return { raw: undefined, version: undefined };
      const text = await new Response(result.stream).text();
      return { raw: JSON.parse(text) as unknown, version };
    },

    async write(leads: unknown, version: string | undefined): Promise<void> {
      const options: Parameters<typeof put>[2] = {
        access: 'private',
        allowOverwrite: version !== undefined,
        contentType: 'application/json',
      };
      if (version !== undefined) options.ifMatch = version;
      try {
        await put(path, JSON.stringify(leads), options);
      } catch (err) {
        if (err instanceof BlobPreconditionFailedError) {
          throw new StorageConflictError(err.message);
        }
        if (version === undefined && (await exists(path))) {
          throw new StorageConflictError('blob already exists');
        }
        throw err;
      }
    },
  };
}

export function createBlobOrderMarkers(): OrderMarkers {
  return {
    has: (orderId: string) => exists(markerPath(orderId)),

    async add(orderId: string): Promise<void> {
      await put(markerPath(orderId), markerBody(orderId), {
        access: 'private',
        allowOverwrite: false,
        addRandomSuffix: false,
        contentType: 'application/json',
      });
    },

    async release(orderId: string): Promise<void> {
      await del(markerPath(orderId));
    },
  };
}
