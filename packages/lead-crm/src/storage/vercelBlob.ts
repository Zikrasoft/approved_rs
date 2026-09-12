import { get, head, put, BlobPreconditionFailedError } from '@vercel/blob';
import {
  StorageConflictError,
  type LeadStorage,
  type StorageSnapshot,
} from './types.ts';

export interface VercelBlobStorageOptions {
  path: string;
}

export function createVercelBlobStorage({
  path,
}: VercelBlobStorageOptions): LeadStorage {
  return {
    async read(): Promise<StorageSnapshot> {
      const result = await get(path, { access: 'private', useCache: false });
      if (!result) return { raw: undefined, version: undefined };
      const text = await new Response(result.stream).text();
      const raw: unknown = JSON.parse(text);
      const version = (await head(path)).etag;
      return { raw, version };
    },

    async write(leads: unknown, version: string | undefined): Promise<void> {
      const options: Parameters<typeof put>[2] = {
        access: 'private',
        allowOverwrite: true,
        contentType: 'application/json',
      };
      if (version) options.ifMatch = version;
      try {
        await put(path, JSON.stringify(leads), options);
      } catch (err) {
        if (err instanceof BlobPreconditionFailedError) {
          throw new StorageConflictError(err.message);
        }
        throw err;
      }
    },
  };
}
