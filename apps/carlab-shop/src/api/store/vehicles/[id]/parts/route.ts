import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { positionGroups } from '@podbor/catalog-contract';
import { z } from 'zod';

import { toFitmentResponse } from '../../../../../lib/store-response';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import type { StoreVehiclePartsType } from '../../../validators';

const partSchema = z.object({
  id: z.string(),
  name: z.string(),
  category_id: z.string().nullable(),
});

export async function GET(
  req: MedusaRequest<unknown, StoreVehiclePartsType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const { steering } = req.validatedQuery as StoreVehiclePartsType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const vehicle = await catalog.retrieveVehicle(id);

  const fitments = await catalog.listFitments(
    { vehicle_id: id },
    { relations: ['part'], take: null },
  );

  const candidates = fitments.map((fitment) => {
    const { category_id, ...part } = partSchema.parse(fitment.part);
    return { ...toFitmentResponse(fitment), category_id, part };
  });

  res.json({
    groups: positionGroups(candidates, {
      steering: steering ?? vehicle.steering ?? undefined,
    }),
  });
}
