import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';

import {
  partResponseSchema,
  withComputedPrices,
} from '../../../modules/part/store-response';
import { VEHICLE_MODULE } from '../../../modules/vehicle';
import type VehicleModuleService from '../../../modules/vehicle/service';

const querySchema = z.object({
  q: z.string().min(1),
  vehicle_id: z.string().min(1).optional(),
});

const PART_FIELDS = [
  'id',
  'name',
  'identifiers.id',
  'identifiers.type',
  'identifiers.brand',
  'identifiers.value',
  'identifiers.offers.id',
  'identifiers.offers.supplier.name',
  'identifiers.offers.supplier.markup_percentage',
  'identifiers.offers.supplier_article_id',
  'identifiers.offers.cost_price',
  'identifiers.offers.stock_quantity',
  'identifiers.offers.lead_time',
];

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { q, vehicle_id } = querySchema.parse(req.query);

  const filters: Record<string, unknown> = { q };

  if (vehicle_id) {
    const vehicleModuleService: VehicleModuleService =
      req.scope.resolve(VEHICLE_MODULE);

    await vehicleModuleService.retrieveVehicle(vehicle_id);

    const fitments = await vehicleModuleService.listFitments({
      vehicle_id,
      status: 'active',
    });
    const partIds = [...new Set(fitments.map((fitment) => fitment.part_id))];

    if (!partIds.length) {
      res.status(404).json({ part: null });
      return;
    }

    filters.id = { $in: partIds };
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.search({
    entity: 'part',
    fields: PART_FIELDS,
    filters,
    pagination: { take: 1 },
  });

  const part = data[0];

  if (!part) {
    res.status(404).json({ part: null });
    return;
  }

  res.json({ part: partResponseSchema.parse(withComputedPrices(part)) });
}
