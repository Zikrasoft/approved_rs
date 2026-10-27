import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';

import { enabledCrawledSites } from '../../../../../lib/crawler/sites';
import { crawlStore } from '../../../../../lib/crawler/store';

export async function POST(
  req: AuthenticatedMedusaRequest,
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
  ).pause(site.name, 'staff');
  res.json({ paused: site.key });
}
