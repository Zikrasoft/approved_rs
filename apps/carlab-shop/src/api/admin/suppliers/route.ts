import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { PART_MODULE } from '../../../modules/part';
import type PartModuleService from '../../../modules/part/service';

const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  markup_percentage: z.number(),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);

  const suppliers = await partModuleService.listSuppliers();

  res.json({ suppliers: z.array(supplierSchema).parse(suppliers) });
}
