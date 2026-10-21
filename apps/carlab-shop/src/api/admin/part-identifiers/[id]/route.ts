import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const supplier: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);

  await catalog.retrievePartIdentifier(id);

  await catalog.deletePartIdentifiers(id);
  await supplier.deleteSupplierOffers({ part_identifier_id: id });

  res.json({ id, object: 'part_identifier', deleted: true });
}
