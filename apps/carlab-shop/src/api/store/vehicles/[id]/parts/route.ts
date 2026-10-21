import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  attributeValuesSchema,
  maintenanceKit,
  positionGroups,
  requirementMatches,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import {
  listVehicleResponses,
  toFitmentResponse,
} from '../../../../../lib/store-response';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import type { StoreVehiclePartsType } from '../../../validators';

const partSchema = z.object({
  id: z.string(),
  name: z.string(),
  category_id: z.string().nullable(),
});

const attributedPartSchema = partSchema.extend({
  attributes: attributeValuesSchema
    .nullable()
    .transform((value) => value ?? {}),
});

export async function GET(
  req: MedusaRequest<unknown, StoreVehiclePartsType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const { steering } = req.validatedQuery as StoreVehiclePartsType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const [vehicle] = await listVehicleResponses(catalog, { id });
  if (!vehicle) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Vehicle ${id} not found`,
    );
  }

  const fitments = await catalog.listFitments(
    { vehicle_id: id },
    { relations: ['part'], take: null },
  );

  const candidates = fitments.map((fitment) => {
    const { category_id, ...part } = partSchema.parse(fitment.part);
    return { ...toFitmentResponse(fitment), category_id, part };
  });

  const groups = positionGroups(candidates, {
    steering: steering ?? vehicle.steering ?? undefined,
  });

  const required = [
    ...new Set(vehicle.requirements.map(({ category_id }) => category_id)),
  ];
  const parts = required.length
    ? z
        .array(attributedPartSchema)
        .parse(
          await catalog.listParts(
            { category_id: required },
            { select: ['id', 'name', 'category_id', 'attributes'], take: null },
          ),
        )
    : [];
  const matches = requirementMatches(parts, vehicle.requirements).map(
    (match) => ({
      ...match,
      parts: match.parts.map((part) => partSchema.parse(part)),
    }),
  );

  res.json({
    groups,
    matches,
    kit: maintenanceKit(
      await catalog.listCategories(
        { maintenance_kit: true },
        { select: ['id', 'maintenance_kit', 'kit_rank'] },
      ),
      groups,
      matches,
    ),
  });
}
