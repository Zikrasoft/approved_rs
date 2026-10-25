import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { STAGED_DATA_KINDS } from '@podbor/catalog-contract';
import { z } from 'zod';

import { announceMarkupChange } from '../../../../lib/suppliers/markup-reindex';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';
import type { AdminUpdateSupplierType } from '../../validators';
import { updatedBy } from '../../../../lib/editors';

const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  markup_percentage: z.number(),
  released_kinds: z.array(z.enum(STAGED_DATA_KINDS)),
  import_enabled: z.boolean(),
  import_on_publish: z.boolean(),
  updated_at: z.date(),
  updated_by: z.string().nullable(),
});

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateSupplierType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;

  const supplierService: SupplierModuleService =
    req.scope.resolve(SUPPLIER_MODULE);

  const before = await supplierService.retrieveSupplier(id);
  const supplier = await supplierService.updateSuppliers({
    id,
    ...req.validatedBody,
    ...updatedBy(req),
  });
  if (supplier.markup_percentage !== before.markup_percentage) {
    await announceMarkupChange(req.scope, id);
  }

  res.json({ supplier: supplierSchema.parse(supplier) });
}
