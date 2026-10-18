import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { PART_MODULE } from '../../../../../modules/part';
import type PartModuleService from '../../../../../modules/part/service';
import { VEHICLE_MODULE } from '../../../../../modules/vehicle';
import type VehicleModuleService from '../../../../../modules/vehicle/service';

const paramsSchema = z.object({
  id: z.string().min(1),
});

const candidateSchema = z.object({
  fitment_id: z.string(),
  production_from: z.date().nullable(),
  production_to: z.date().nullable(),
  steering: z.enum(['left', 'right']).nullable(),
  gearbox: z.enum(['manual', 'automatic']).nullable(),
});

const partEntrySchema = z.object({
  part: z.object({ id: z.string(), name: z.string() }),
  ambiguous: z.boolean(),
  candidates: z.array(candidateSchema),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = paramsSchema.parse(req.params);

  const vehicleModuleService: VehicleModuleService =
    req.scope.resolve(VEHICLE_MODULE);
  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);

  await vehicleModuleService.retrieveVehicle(id);

  const fitments = await vehicleModuleService.listFitments({
    vehicle_id: id,
    status: 'active',
  });

  const fitmentsByPartId = new Map<string, (typeof fitments)[number][]>();
  for (const fitment of fitments) {
    const group = fitmentsByPartId.get(fitment.part_id) ?? [];
    group.push(fitment);
    fitmentsByPartId.set(fitment.part_id, group);
  }

  const partIds = [...fitmentsByPartId.keys()];
  const parts = partIds.length
    ? await partModuleService.listParts({ id: partIds })
    : [];
  const partById = new Map(parts.map((part) => [part.id, part]));

  const entries = partIds
    .map((partId) => {
      const part = partById.get(partId);
      if (!part) {
        return null;
      }

      const group = fitmentsByPartId.get(partId)!;
      return {
        part: { id: part.id, name: part.name },
        ambiguous: group.length > 1,
        candidates: group.map((fitment) => ({
          fitment_id: fitment.id,
          production_from: fitment.production_from,
          production_to: fitment.production_to,
          steering: fitment.steering,
          gearbox: fitment.gearbox,
        })),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  res.json({ parts: z.array(partEntrySchema).parse(entries) });
}
