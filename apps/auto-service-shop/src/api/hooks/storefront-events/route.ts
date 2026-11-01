import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { storefrontEventSchema } from '@podbor/catalog-contract/events';

import { logStorefrontEvent } from '../../../lib/log-event';

export function POST(req: MedusaRequest, res: MedusaResponse): void {
  const parsed = storefrontEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Not a storefront event' });
    return;
  }
  logStorefrontEvent(parsed.data, req.requestId ?? null);
  res.status(204).end();
}
