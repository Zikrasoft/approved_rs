import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { enabledCrawledSites } from '../../../lib/crawler/sites';
import { crawlStore } from '../../../lib/crawler/store';

const WORKER_STALE_MS = 60_000;

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const sites = enabledCrawledSites();
  const store = crawlStore(
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
  );
  const progress = await store.progress(sites.map(({ name }) => name));
  const seenAt = await store.workerSeenAt();
  const waiting = progress.some(
    ({ run }) => run?.status === 'queued' || run?.status === 'running',
  );
  res.json({
    worker_missing:
      waiting && (!seenAt || Date.now() - seenAt.getTime() > WORKER_STALE_MS),
    crawls: sites.map(({ key, name }, index) => {
      const { run, pages, failures } = progress[index];
      return {
        key,
        supplier: name,
        status: run?.status ?? 'idle',
        paused_reason: run?.paused_reason ?? null,
        started_at: run?.started_at ?? null,
        finished_at: run?.finished_at ?? null,
        pages,
        failures,
      };
    }),
  });
}
