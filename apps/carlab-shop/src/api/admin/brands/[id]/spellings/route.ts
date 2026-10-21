import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../modules/supplier/service';
import type { AdminCreateBrandSpellingType } from '../../../validators';
import { alreadyExists } from '../../../../../lib/admin-errors';
import { spellingKey } from '../../../../../lib/suppliers/spelling';

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
  const taken = await catalog.listBrandSpellings(
    { supplier_id },
    { select: ['value'], take: null },
  );
  if (
    taken.some((spelling) => spellingKey(spelling.value) === spellingKey(value))
  ) {
    throw alreadyExists(
      'brand_spelling',
      `This supplier already spells a Brand as ${value}`,
    );
  }

  const spelling = await catalog.createBrandSpellings({
    brand_id: id,
    supplier_id,
    value,
    created_by: req.auth_context.actor_id,
    updated_by: req.auth_context.actor_id,
  });

  res.json({ spelling });
}
