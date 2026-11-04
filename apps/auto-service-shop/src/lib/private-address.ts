import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';

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

export const isPrivateAddress = (address: string): boolean =>
  privateRanges.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');

const privateAddressError = (address: string) =>
  new Error(`${address} is a private address`);

export const publicLookup: LookupFunction = (hostname, options, callback) =>
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    const refused = addresses.find(({ address }) => isPrivateAddress(address));
    if (refused) return callback(privateAddressError(refused.address), []);
    if (options.all) return callback(null, addresses);
    const [{ address, family }] = addresses as LookupAddress[];
    callback(null, address, family);
  });

const bareHost = (url: URL) => url.hostname.replace(/^\[|\]$/g, '');

export function refusePrivateHost(url: URL): void {
  const host = bareHost(url);
  if (isIP(host) && isPrivateAddress(host)) throw privateAddressError(host);
}

export async function assertPublicUrl(url: URL): Promise<void> {
  refusePrivateHost(url);
  const host = bareHost(url);
  if (isIP(host)) return;
  await new Promise<void>((resolve, reject) =>
    publicLookup(host, { all: true }, (error) =>
      error ? reject(error) : resolve(),
    ),
  );
}
