import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { crawlTarget } from '../../../../../lib/crawler/admin-target';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { site, store } = crawlTarget(req);
  await store.pause(site.name, 'staff');
  res.json({ paused: site.key });
}
