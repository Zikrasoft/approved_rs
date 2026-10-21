import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { STAGED_DATA_KINDS } from '@podbor/catalog-contract';
import { z } from 'zod';

import { SUPPLIER_MODULE } from '../../../modules/supplier';
import type SupplierModuleService from '../../../modules/supplier/service';

const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  markup_percentage: z.number(),
  released_kinds: z.array(z.enum(STAGED_DATA_KINDS)),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const supplier: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);

  const suppliers = await supplier.listSuppliers(
    {},
    { order: { name: 'ASC' } },
  );

  res.json({ suppliers: z.array(supplierSchema).parse(suppliers) });
}
