import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { crawlTarget } from '../../../../lib/crawler/admin-target';
import type { AdminStartCrawlType } from '../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminStartCrawlType>,
  res: MedusaResponse,
): Promise<void> {
  const { site, store } = crawlTarget(req);
  await store.start(site.name, new Date(), req.validatedBody.limit ?? null);
  res.json({ started: site.key });
}
