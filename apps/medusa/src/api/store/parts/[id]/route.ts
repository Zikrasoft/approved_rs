import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';
import {
  PART_WITH_OFFERS_RELATIONS,
  partResponseSchema,
  withComputedPrices,
} from '../../../../modules/part/store-response';

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = paramsSchema.parse(req.params);

  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);

  const part = await partModuleService.retrievePart(id, {
    relations: PART_WITH_OFFERS_RELATIONS,
  });

  res.json({ part: partResponseSchema.parse(withComputedPrices(part)) });
}
