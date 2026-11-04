import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  type StorefrontEvent,
  storefrontEventSchema,
} from '@podbor/catalog-contract/events';

import { logEvent, logStorefrontEvent } from '../../../lib/log-event';
import { demandModule, identifiersOfSlugs } from '../../../lib/part-demand';

type DemandEvent = Extract<StorefrontEvent, { event: 'storefront.demand' }>;

async function countDemand(
  req: MedusaRequest,
  { signal, parts, request_id }: DemandEvent,
): Promise<void> {
  const identifierIds = await identifiersOfSlugs(req.scope, parts);
  await demandModule(req.scope).record({
    signal,
    identifierIds,
    key: request_id ? `${signal}:${request_id}` : null,
  });
  logEvent(
    'storefront.demand',
    { signal, parts: new Set(parts).size, matched: identifierIds.length },
    request_id ?? req.requestId ?? null,
  );
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = storefrontEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Not a storefront event' });
    return;
  }
  if (parsed.data.event === 'storefront.demand') {
    await countDemand(req, parsed.data);
  } else {
    logStorefrontEvent(parsed.data, req.requestId ?? null);
  }
  res.status(204).end();
}
