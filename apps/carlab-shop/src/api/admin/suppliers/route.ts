import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { STAGED_DATA_KINDS } from '@podbor/catalog-contract';
import { z } from 'zod';

import { withEditors } from '../../../lib/editors';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import type SupplierModuleService from '../../../modules/supplier/service';

const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  markup_percentage: z.number(),
  released_kinds: z.array(z.enum(STAGED_DATA_KINDS)),
  import_enabled: z.boolean(),
  updated_at: z.date(),
  updated_by: z.string().nullable(),
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

  const offerCounts = await Promise.all(
    suppliers.map(async ({ id }) => {
      const [, count] = await supplier.listAndCountSupplierOffers(
        { supplier_id: id },
        { select: ['id'], take: 1 },
      );
      return count;
    }),
  );

  res.json({
    suppliers: await withEditors(
      req.scope,
      z
        .array(supplierSchema)
        .parse(suppliers)
        .map((row, index) => ({ ...row, offer_count: offerCounts[index] })),
    ),
  });
}
