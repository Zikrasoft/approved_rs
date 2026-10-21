import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';
import type { AdminUpdateSupplierType } from '../../validators';

const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  markup_percentage: z.number(),
});

export async function POST(
  req: MedusaRequest<AdminUpdateSupplierType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const { markup_percentage } = req.validatedBody;

  const supplierService: SupplierModuleService =
    req.scope.resolve(SUPPLIER_MODULE);

  await supplierService.retrieveSupplier(id);
  const supplier = await supplierService.updateSuppliers({
    id,
    markup_percentage,
  });

  res.json({ supplier: supplierSchema.parse(supplier) });
}
