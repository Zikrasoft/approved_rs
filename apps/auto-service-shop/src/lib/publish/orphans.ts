import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { ORPHAN_SWEEPS } from '../../modules/catalog/cross-module-sql';

export async function sweepOrphans(scope: MedusaContainer): Promise<void> {
  const pg = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  await pg.transaction(async (trx) => {
    for (const sweep of ORPHAN_SWEEPS) await trx.raw(sweep);
  });
}
