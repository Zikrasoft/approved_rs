import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';
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
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const [, mappings] = await suppliers.listAndCountSupplierCategories(
    { category_id: id },
    { select: ['id'], take: 1 },
  );
  await deleteUnlessHeld(req, CATEGORIES, id, [
    { entity: 'supplier_category', count: mappings },
  ]);
  res.json({ id, object: 'category', deleted: true });
}
