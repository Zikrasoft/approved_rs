import { createHash } from 'node:crypto';
import { get as httpGet, type IncomingMessage } from 'node:http';
import { get as httpsGet } from 'node:https';
import type { LookupFunction } from 'node:net';

import type { Logger, MedusaContainer } from '@medusajs/framework/types';

import { errorMessage } from '../errors';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '../images';
import { publicLookup, refusePrivateHost } from '../private-address';
import type { ShopStorage } from '../storage';

export const IMAGE_LOOKUP_REGISTRATION = 'supplierImageLookup';

const FETCH_TIMEOUT_MS = 30_000;

const imageLookup = (scope: MedusaContainer): LookupFunction =>
  scope.hasRegistration(IMAGE_LOOKUP_REGISTRATION)
    ? scope.resolve<LookupFunction>(IMAGE_LOOKUP_REGISTRATION)
    : publicLookup;

const getters = { 'http:': httpGet, 'https:': httpsGet } as const;

const isFetchable = (protocol: string): protocol is keyof typeof getters =>
  protocol === 'http:' || protocol === 'https:';

async function request(
  url: URL,
  lookup: LookupFunction,
): Promise<IncomingMessage> {
  if (!isFetchable(url.protocol)) {
    throw new Error(`${url.protocol} is not fetched`);
  }
  refusePrivateHost(url);
  const get = getters[url.protocol];
  return new Promise((resolve, reject) =>
    get(
      url,
      { lookup, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      resolve,
    ).on('error', reject),
  );
}

async function download(
  source: string,
  lookup: LookupFunction,
): Promise<{ body: Buffer; contentType: string }> {
  const response = await request(new URL(source), lookup);
  const contentType = (response.headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (response.statusCode !== 200 || !IMAGE_TYPES[contentType]) {
    response.destroy();
    throw new Error(`HTTP ${response.statusCode}, ${contentType || 'no type'}`);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES) {
      response.destroy();
      throw new Error(`over ${MAX_IMAGE_BYTES} bytes`);
    }
    chunks.push(chunk);
  }
  return { body: Buffer.concat(chunks), contentType };
}

const sha256 = (data: string | Buffer) =>
  createHash('sha256').update(data).digest('hex');

export async function mirroredImage(
  scope: MedusaContainer,
  storage: ShopStorage,
  source: string,
  logger: Logger,
): Promise<string | null> {
  if (source.startsWith(storage.publicUrl(''))) return source;
  const pointer = `supplier-images/by-source/${sha256(source)}`;
  const known = await storage.images.get(pointer);
  if (known) return storage.publicUrl(known.toString());
  try {
    const { body, contentType } = await download(source, imageLookup(scope));
    const key = `supplier-images/${sha256(body)}`;
    if (!(await storage.images.has(key))) {
      await storage.images.put(key, body, {
        contentType,
        metadata: { 'source-url': new URL(source).href },
      });
    }
    await storage.images.put(pointer, Buffer.from(key), {
      contentType: 'text/plain',
    });
    return storage.publicUrl(key);
  } catch (error) {
    logger.warn(
      `Supplier image ${source} not copied, staged without it: ${errorMessage(error)}`,
    );
    return null;
  }
}
