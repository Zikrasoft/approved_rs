import type { MedusaRequest } from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';

import type { CrawledSite } from './site';
import { enabledCrawledSites } from './sites';
import { crawlStore, type CrawlStore } from './store';

export function crawlTarget(req: MedusaRequest): {
  site: CrawledSite;
  store: CrawlStore;
} {
  const site = enabledCrawledSites().find(({ key }) => key === req.params.key);
  if (!site) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No crawler reads ${req.params.key}`,
    );
  }
  return {
    site,
    store: crawlStore(
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
    ),
  };
}
