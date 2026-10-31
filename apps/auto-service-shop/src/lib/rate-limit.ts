import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { isPrivateAddress } from './private-address';

const MAX_TRACKED_CLIENTS = 10_000;

type ClientRequest = Pick<MedusaRequest, 'ip' | 'socket'>;

export const clientAddress = ({ ip, socket }: ClientRequest): string => {
  const peer = socket.remoteAddress ?? '';
  return peer && isPrivateAddress(peer) ? (ip ?? peer) : peer;
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
