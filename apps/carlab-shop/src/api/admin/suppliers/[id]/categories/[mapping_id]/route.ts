import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { SUPPLIER_MODULE } from '../../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../../modules/supplier/service';

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, mapping_id } = req.params;

  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);

  const [mapping] = await suppliers.listSupplierCategories({
    id: mapping_id,
    supplier_id: id,
  });
  if (mapping) {
    await suppliers.deleteSupplierCategories(mapping.id);
  }

  res.json({ id: mapping_id, object: 'supplier_category', deleted: true });
}
