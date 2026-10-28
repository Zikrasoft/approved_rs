import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

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
  await catalog.renameSlug(kind, id, slug, createdBy(req));
  res.json({ kind, id, slug });
}
