import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

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
  await catalog.mergeMakes(id, into);
  res.json({ id, into, object: 'make', merged: true });
}
