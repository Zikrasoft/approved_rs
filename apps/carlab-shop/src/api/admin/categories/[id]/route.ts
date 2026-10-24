import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import type { AdminUpdateCategoryType } from '../../validators';
import { updatedBy } from '../../../../lib/editors';
import { guardCategoryService } from '../../../../lib/categories';
import { CATEGORIES, deleteUnlessHeld } from '../../vehicle-reference-routes';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateCategoryType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const stored = await catalog.retrieveCategory(id);
  guardCategoryService({
    service_label: stored.service_label,
    service_price: stored.service_price,
    ...req.validatedBody,
  });
  const category = await catalog.updateCategories({
    id,
    ...req.validatedBody,
    ...updatedBy(req),
  });

  res.json({ category });
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  await deleteUnlessHeld(req, CATEGORIES, id);
  res.json({ id, object: 'category', deleted: true });
}
