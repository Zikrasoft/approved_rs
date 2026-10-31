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
import { secretMatches } from '@podbor/lead-crm/verify-secret';
import { z } from 'zod';

import { parseEnv } from './env';
import { isPrivateAddress } from './private-address';

const MAX_TRACKED_CLIENTS = 10_000;

type ClientRequest = Pick<MedusaRequest, 'ip' | 'socket' | 'headers'>;

const headerSchema = z.string().max(256).optional().catch(undefined);

const storefrontVisitor = ({ headers }: ClientRequest): string | null => {
  const { SHOP_LEAD_SECRET, SHOP_LEAD_SECRET_PREVIOUS } = parseEnv(process.env);
  const vouched = secretMatches(
    headerSchema.parse(headers[SHOP_CLIENT_SECRET_HEADER]),
    [SHOP_LEAD_SECRET, SHOP_LEAD_SECRET_PREVIOUS],
  );
  const visitor = headerSchema.parse(headers[SHOP_CLIENT_HEADER]);
  return vouched && visitor && isIP(visitor) ? visitor : null;
};

export const clientAddress = (req: ClientRequest): string => {
  const peer = req.socket.remoteAddress ?? '';
  const proxied = peer && isPrivateAddress(peer) ? (req.ip ?? peer) : peer;
  return storefrontVisitor(req) ?? proxied;
};

type RateLimit = { limit: number; windowMs: number; now?: () => number };

// TODO: the windows live in this process's memory, so a restart forgets them and a second Medusa process would double every limit; keep them in Redis once the shop runs more than one.
export function rateLimit({ limit, windowMs, now = Date.now }: RateLimit) {
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
    const client = clientAddress(req);
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
