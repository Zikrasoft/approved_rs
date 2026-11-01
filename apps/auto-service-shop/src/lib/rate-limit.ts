import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { isIP } from 'node:net';

import {
  SHOP_CLIENT_HEADER,
  SHOP_CLIENT_SECRET_HEADER,
} from '@podbor/catalog-contract/preview';
import {
  acceptedSecrets,
  type AcceptedSecrets,
  secretMatches,
} from '@podbor/lead-crm/verify-secret';
import { z } from 'zod';

import { parseEnv } from './env';
import { isPrivateAddress } from './private-address';

const MAX_TRACKED_CLIENTS = 10_000;

type ClientRequest = Pick<MedusaRequest, 'ip' | 'socket' | 'headers'>;

const headerSchema = z.string().max(256).optional().catch(undefined);

const storefrontVisitor = (
  { headers }: ClientRequest,
  vouchers: AcceptedSecrets,
): string | null => {
  const vouched = secretMatches(
    headerSchema.parse(headers[SHOP_CLIENT_SECRET_HEADER]),
    vouchers,
  );
  const visitor = headerSchema.parse(headers[SHOP_CLIENT_HEADER]);
  return vouched && visitor && isIP(visitor) ? visitor : null;
};

export const clientAddress = (
  req: ClientRequest,
  vouchers: AcceptedSecrets,
): string => {
  const peer = req.socket.remoteAddress ?? '';
  const proxied = peer && isPrivateAddress(peer) ? (req.ip ?? peer) : peer;
  return storefrontVisitor(req, vouchers) ?? proxied;
};

const IPV4_MAPPED = /^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/;

export const networkOf = (address: string): string => {
  const withoutZone = address.split('%')[0]!;
  if (isIP(withoutZone) !== 6) return address;
  const canonical = new URL(`http://[${withoutZone}]`).hostname.slice(1, -1);
  if (IPV4_MAPPED.test(canonical)) return canonical;
  const [head, tail] = canonical.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const zeros = Array<string>(8 - left.length - right.length).fill('0');
  return `${[...left, ...zeros, ...right].slice(0, 4).join(':')}::/64`;
};

export const storefrontSecrets = (env = parseEnv(process.env)) => [
  ...acceptedSecrets(env, 'SHOP_CLIENT_SECRET'),
  // TODO: drop SHOP_LEAD_SECRET here once every storefront sends SHOP_CLIENT_SECRET.
  ...acceptedSecrets(env, 'SHOP_LEAD_SECRET'),
];

type RateLimit = {
  limit: number;
  windowMs: number;
  now?: () => number;
  vouchers?: AcceptedSecrets;
};

// TODO: the windows live in this process's memory, so a restart forgets them and a second Medusa process would double every limit; keep them in Redis once the shop runs more than one.
export function rateLimit({
  limit,
  windowMs,
  now = Date.now,
  vouchers = storefrontSecrets(),
}: RateLimit) {
  const hits = new Map<string, number[]>();

  const forgetIdle = (since: number) => {
    for (const [client, times] of hits) {
      if (times[times.length - 1]! <= since) hits.delete(client);
    }
  };

  return (
    req: ClientRequest,
    res: Pick<MedusaResponse, 'setHeader' | 'status'>,
    next: MedusaNextFunction,
  ): void => {
    const at = now();
    const since = at - windowMs;
    const client = networkOf(clientAddress(req, vouchers));
    const recent = (hits.get(client) ?? []).filter((time) => time > since);
    if (recent.length >= limit) {
      hits.set(client, recent);
      res.setHeader(
        'Retry-After',
        String(Math.ceil((recent[0]! - since) / 1000)),
      );
      res.status(429).json({
        type: 'too_many_requests',
        message: 'Too many requests, try again later',
      });
      return;
    }
    hits.set(client, [...recent, at]);
    if (hits.size > MAX_TRACKED_CLIENTS) forgetIdle(since);
    next();
  };
}
