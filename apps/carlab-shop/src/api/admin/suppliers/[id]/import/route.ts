import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { supplierAdapters } from '../../../../../lib/suppliers/adapter';
import { importSupplier } from '../../../../../lib/suppliers/import';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../modules/supplier/service';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const supplier = await suppliers.retrieveSupplier(req.params.id);
  if (!supplier.import_enabled) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `The import of ${supplier.name} is switched off`,
    );
  }
  const adapter = supplierAdapters(req.scope).find(
    ({ name }) => name === supplier.name,
  );
  if (!adapter) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No adapter reads ${supplier.name}`,
    );
  }
  res.json({ import: await importSupplier(req.scope, adapter) });
}
