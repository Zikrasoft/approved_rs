import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../../../../modules/catalog';
import {
  FITMENT_GEARBOX_TYPES,
  FITMENT_STEERING_SIDES,
} from '../../../../../modules/catalog/models/fitment';
import type CatalogModuleService from '../../../../../modules/catalog/service';

const candidateSchema = z.object({
  fitment_id: z.string(),
  production_from: z.date().nullable(),
  production_to: z.date().nullable(),
  steering: z.enum(FITMENT_STEERING_SIDES).nullable(),
  gearbox: z.enum(FITMENT_GEARBOX_TYPES).nullable(),
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
  const { id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.retrieveVehicle(id);

  const fitments = await catalog.listFitments(
    { vehicle_id: id },
    { relations: ['part'] },
  );

  const fitmentsByPartId = new Map<string, typeof fitments>();
  for (const fitment of fitments) {
    const group = fitmentsByPartId.get(fitment.part_id) ?? [];
    group.push(fitment);
    fitmentsByPartId.set(fitment.part_id, group);
  }

  const entries = [...fitmentsByPartId.values()].map((group) => ({
    part: { id: group[0].part.id, name: group[0].part.name },
    ambiguous: group.length > 1,
    candidates: group.map((fitment) => ({
      fitment_id: fitment.id,
      production_from: fitment.production_from,
      production_to: fitment.production_to,
      steering: fitment.steering,
      gearbox: fitment.gearbox,
    })),
  }));

  res.json({ parts: z.array(partEntrySchema).parse(entries) });
}
