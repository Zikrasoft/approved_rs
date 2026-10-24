import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../modules/supplier/service';
import type { AdminCreateBrandSpellingType } from '../../../validators';
import { createdBy } from '../../../../../lib/editors';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateBrandSpellingType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const { supplier_id, value } = req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);

  await catalog.retrieveBrand(id);
  await suppliers.retrieveSupplier(supplier_id);
  const spelling = await catalog.createBrandSpellings({
    brand_id: id,
    supplier_id,
    value,
    ...createdBy(req),
  });

  res.json({ spelling });
}
