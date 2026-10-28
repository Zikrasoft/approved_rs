import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import {
  claimCatalogueWriter,
  holdCatalogueWriter,
} from '../../../lib/catalogue-writer';
import { createdBy } from '../../../lib/editors';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { AdminRenameSlugType } from '../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminRenameSlugType>,
  res: MedusaResponse,
): Promise<void> {
  const { kind, id, slug } = req.validatedBody;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const run = await claimCatalogueWriter(req.scope, {
    kind: 'rename',
    created_by: req.auth_context.actor_id,
  });
  await holdCatalogueWriter(req.scope, run.id, () =>
    catalog.renameSlug(kind, id, slug, createdBy(req)),
  );
  res.json({ kind, id, slug });
}
