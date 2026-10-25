import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { enabledCrawledSites } from '../../../lib/crawler/sites';
import { crawlStore } from '../../../lib/crawler/store';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const sites = enabledCrawledSites();
  const progress = await crawlStore(
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
  ).progress(sites.map(({ name }) => name));
  res.json({
    crawls: sites.map(({ key, name }, index) => {
      const { run, pages } = progress[index];
      return {
        key,
        supplier: name,
        status: run?.status ?? 'idle',
        paused_reason: run?.paused_reason ?? null,
        started_at: run?.started_at ?? null,
        finished_at: run?.finished_at ?? null,
        pages,
      };
    }),
  });
}
