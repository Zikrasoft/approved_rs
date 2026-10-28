import { createHash } from 'node:crypto';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { get as httpGet, type IncomingMessage } from 'node:http';
import { get as httpsGet } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

import type { Logger, MedusaContainer } from '@medusajs/framework/types';

import { errorMessage } from '../errors';
import { MAX_IMAGE_BYTES } from '../images';
import type { ShopStorage } from '../storage';

export const IMAGE_LOOKUP_REGISTRATION = 'supplierImageLookup';

const FETCH_TIMEOUT_MS = 30_000;

const privateRanges = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 127],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv6');
}

const isPrivate = (address: string) =>
  privateRanges.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');

const privateAddressError = (address: string) =>
  new Error(`${address} is a private address`);

export const publicLookup: LookupFunction = (hostname, options, callback) =>
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    const refused = addresses.find(({ address }) => isPrivate(address));
    if (refused) return callback(privateAddressError(refused.address), []);
    if (options.all) return callback(null, addresses);
    const [{ address, family }] = addresses as LookupAddress[];
    callback(null, address, family);
  });

const imageLookup = (scope: MedusaContainer): LookupFunction =>
  scope.hasRegistration(IMAGE_LOOKUP_REGISTRATION)
    ? scope.resolve<LookupFunction>(IMAGE_LOOKUP_REGISTRATION)
    : publicLookup;

const getters = { 'http:': httpGet, 'https:': httpsGet } as const;

const isFetchable = (protocol: string): protocol is keyof typeof getters =>
  protocol === 'http:' || protocol === 'https:';

function request(url: URL, lookup: LookupFunction): Promise<IncomingMessage> {
  if (!isFetchable(url.protocol)) {
    return Promise.reject(new Error(`${url.protocol} is not fetched`));
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isPrivate(host)) {
    return Promise.reject(privateAddressError(host));
  }
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
  const contentType = response.headers['content-type'] ?? '';
  if (response.statusCode !== 200 || !contentType.startsWith('image/')) {
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
