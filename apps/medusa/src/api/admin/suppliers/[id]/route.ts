import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  markup_percentage: z.number().min(0),
});

const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  markup_percentage: z.number(),
});

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = paramsSchema.parse(req.params);
  const { markup_percentage } = bodySchema.parse(req.body);

  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);

  const supplier = await partModuleService.updateSuppliers({
    id,
    markup_percentage,
  });

  res.json({ supplier: supplierSchema.parse(supplier) });
}
