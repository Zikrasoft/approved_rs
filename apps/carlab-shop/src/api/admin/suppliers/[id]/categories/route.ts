import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { withEditors } from '../../../../../lib/editors';

import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../modules/supplier/service';
import type { AdminCreateSupplierCategoryType } from '../../../validators';

const MAPPING_FIELDS = [
  'id',
  'code',
  'category_id',
  'updated_at',
  'updated_by',
];

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);

  const categories = await suppliers.listSupplierCategories(
    { supplier_id: req.params.id },
    { select: MAPPING_FIELDS, order: { code: 'ASC' }, take: null },
  );

  res.json({ categories: await withEditors(req.scope, categories) });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateSupplierCategoryType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const { code, category_id } = req.validatedBody;

  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await suppliers.retrieveSupplier(id);
  await catalog.retrieveCategory(category_id);
  const { id: mappingId } = await suppliers.createSupplierCategories({
    supplier_id: id,
    code,
    category_id,
    created_by: req.auth_context.actor_id,
    updated_by: req.auth_context.actor_id,
  });

  res.json({ category: { id: mappingId, code, category_id } });
}
