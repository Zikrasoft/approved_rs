import { createHash } from 'node:crypto';

import type { Logger } from '@medusajs/framework/types';

import { MAX_IMAGE_BYTES } from '../images';
import type { ShopStorage } from '../storage';

const FETCH_TIMEOUT_MS = 30_000;

async function download(
  source: string,
): Promise<{ body: Buffer; contentType: string }> {
  const response = await fetch(source, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.startsWith('image/')) {
    throw new Error(`HTTP ${response.status}, ${contentType || 'no type'}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_IMAGE_BYTES) {
    throw new Error(`${body.length} bytes is over ${MAX_IMAGE_BYTES}`);
  }
  return { body, contentType };
}

export async function mirroredImage(
  storage: ShopStorage,
  source: string,
  logger: Logger,
): Promise<string> {
  if (source.startsWith(storage.publicUrl(''))) return source;
  const key = `supplier-images/${createHash('sha256').update(source).digest('hex')}`;
  if (await storage.images.has(key)) return storage.publicUrl(key);
  try {
    const { body, contentType } = await download(source);
    await storage.images.put(key, body, {
      contentType,
      metadata: { 'source-url': new URL(source).href },
    });
    return storage.publicUrl(key);
  } catch (error) {
    logger.warn(
      `Supplier image ${source} stays linked, not copied: ${error instanceof Error ? error.message : String(error)}`,
    );
    return source;
  }
}
