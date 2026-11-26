import type {
  ISearchModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import type { ScheduledJobContext } from '@medusajs/framework/jobs';
import { Modules } from '@medusajs/framework/utils';

import { CATALOGUE_CAR_INDEX } from '../lib/car-pages';
import { PART_IDENTIFIER_INDEX } from '../search/part-changed-event';

export const REBUILD_HOUR_IN_BELGRADE = 4;

const belgradeHour = (at: Date) =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Belgrade',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(at),
  );

export default async function reindexSearch(
  container: MedusaContainer,
  { scheduledFor }: ScheduledJobContext,
): Promise<void> {
  if (belgradeHour(scheduledFor) !== REBUILD_HOUR_IN_BELGRADE) return;
  await container.resolve<ISearchModuleService>(Modules.SEARCH).reindex({
    index: [PART_IDENTIFIER_INDEX, CATALOGUE_CAR_INDEX],
    strategy: 'swap',
  });
}

export const config = {
  name: 'reindex-search',
  schedule: '0 * * * *',
};
