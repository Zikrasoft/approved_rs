import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';

import { enabledCrawledSites } from '../../../../lib/crawler/sites';
import { crawlStore } from '../../../../lib/crawler/store';
import type { AdminStartCrawlType } from '../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminStartCrawlType>,
  res: MedusaResponse,
): Promise<void> {
  const site = enabledCrawledSites().find(({ key }) => key === req.params.key);
  if (!site) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No crawler reads ${req.params.key}`,
    );
  }
  await crawlStore(
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
  ).start(site.name, new Date(), req.validatedBody.limit ?? null);
  res.json({ started: site.key });
}
