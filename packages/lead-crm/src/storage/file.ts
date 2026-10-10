import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  link,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ORDER_MARKER_PREFIX,
  markerBody,
  markerPath,
  type OrderMarkers,
} from '../orderMarkers.ts';
import {
  StorageConflictError,
  type LeadStorage,
  type StorageSnapshot,
} from './types.ts';

export interface FileStorageOptions {
  path: string;
  dir: string;
}

const versionOf = (text: string): string =>
  createHash('sha1').update(text).digest('hex');

const hasCode = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;
const isMissing = (error: unknown) => hasCode(error, 'ENOENT');
const isExisting = (error: unknown) => hasCode(error, 'EEXIST');

export function createFileStorage({
  path,
  dir,
}: FileStorageOptions): LeadStorage {
  const file = join(dir, path);

  async function read(): Promise<StorageSnapshot> {
    try {
      const text = await readFile(file, 'utf8');
      return { raw: JSON.parse(text) as unknown, version: versionOf(text) };
    } catch (error) {
      if (isMissing(error)) return { raw: undefined, version: undefined };
      throw error;
    }
  }

  return {
    read,

    async write(leads: unknown, version: string | undefined): Promise<void> {
      await mkdir(dirname(file), { recursive: true });
      const staging = `${file}.${randomUUID()}.tmp`;
      if (version === undefined) {
        await writeFile(staging, JSON.stringify(leads));
        try {
          await link(staging, file);
        } catch (error) {
          throw isExisting(error) ? new StorageConflictError() : error;
        } finally {
          await unlink(staging);
        }
        return;
      }
      if (version !== (await read()).version) throw new StorageConflictError();
      await writeFile(staging, JSON.stringify(leads));
      await rename(staging, file);
    },
  };
}

export function createFileOrderMarkers({ dir }: { dir: string }): OrderMarkers {
  const fileFor = (orderId: string) => join(dir, markerPath(orderId));

  return {
    async has(orderId: string): Promise<boolean> {
      try {
        await access(fileFor(orderId));
        return true;
      } catch {
        return false;
      }
    },

    async add(orderId: string): Promise<void> {
      await mkdir(join(dir, ORDER_MARKER_PREFIX), { recursive: true });
      await writeFile(fileFor(orderId), markerBody(orderId), { flag: 'wx' });
    },

    async release(orderId: string): Promise<void> {
      await unlink(fileFor(orderId));
    },
  };
}
