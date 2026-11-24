import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import {
  claimCatalogueWriter,
  holdCatalogueWriter,
} from '../../../../../lib/catalogue-writer';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import type { AdminMergeType } from '../../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminMergeType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const { into } = req.validatedBody;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const run = await claimCatalogueWriter(req.scope, {
    kind: 'merge',
    created_by: req.auth_context.actor_id,
  });
  await holdCatalogueWriter(req.scope, run.id, () =>
    catalog.mergeMakes(id, into),
  );
  res.json({ id, into, object: 'make', merged: true });
}
