import type { MedusaContainer } from '@medusajs/framework/types';

import { emitIndexChanges } from '../lib/index-changes';
import { daysBack, demandModule } from '../lib/part-demand';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { DEMAND_WINDOW_DAYS } from '../modules/demand/ranking';

export const DEMAND_KEPT_DAYS = 120;

export async function refreshPartDemandAt(
  container: MedusaContainer,
  now: Date,
): Promise<void> {
  const demand = demandModule(container);
  await demand.pruneBefore(daysBack(now, DEMAND_KEPT_DAYS));
  const moving = await demand.countsSince(
    daysBack(now, DEMAND_WINDOW_DAYS + 1),
  );
  const identifiers = await container
    .resolve<CatalogModuleService>(CATALOG_MODULE)
    .listPartIdentifiers(
      { id: moving.map(({ id }) => id) },
      { select: ['part_id'], take: null },
    );
  await emitIndexChanges(container, {
    partIds: identifiers.map(({ part_id }) => part_id),
  });
}

export default async function refreshPartDemand(container: MedusaContainer) {
  await refreshPartDemandAt(container, new Date());
}

export const config = {
  name: 'refresh-part-demand',
  schedule: '20 3 * * *',
};
