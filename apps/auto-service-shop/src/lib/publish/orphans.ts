import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { ORPHAN_SWEEPS } from '../../modules/catalog/cross-module-sql';

export async function sweepOrphans(scope: MedusaContainer): Promise<string[]> {
  const pg = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  return pg.transaction(async (trx) => {
    const swept: string[] = [];
    for (const sweep of ORPHAN_SWEEPS) {
      const { rows } = await trx.raw(sweep);
      swept.push(...rows.map(({ id }: { id: string }) => id));
    }
    return swept;
  });
}
