import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { SUPPLIER_MODULE } from '../../../modules/supplier';
import type SupplierModuleService from '../../../modules/supplier/service';

const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  markup_percentage: z.number(),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const supplier: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);

  const suppliers = await supplier.listSuppliers();

  res.json({ suppliers: z.array(supplierSchema).parse(suppliers) });
}
