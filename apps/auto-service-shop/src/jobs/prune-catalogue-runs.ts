import type { MedusaContainer } from '@medusajs/framework/types';

import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';

export const RUNS_KEPT_FOR_DAYS = 90;
const DAY_MS = 86_400_000;

export const pruneCatalogueRunsAt = (
  container: MedusaContainer,
  now: Date,
): Promise<number> =>
  container
    .resolve<PublishModuleService>(PUBLISH_MODULE)
    .pruneRunsBefore(new Date(now.getTime() - RUNS_KEPT_FOR_DAYS * DAY_MS));

export default async function pruneCatalogueRuns(container: MedusaContainer) {
  await pruneCatalogueRunsAt(container, new Date());
}

export const config = {
  name: 'prune-catalogue-runs',
  schedule: '50 3 * * *',
};
