import { MedusaError } from '@medusajs/framework/utils';
import {
  type AttributeValues,
  attributeValuesSchema,
  matchesRequirements,
  type VehicleRequirement,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { matchesFilter, type VehicleFilter } from '../modules/catalog/service';
import type CatalogModuleService from '../modules/catalog/service';
import { adminError } from './admin-errors';
import { carLabel } from './order-lead';
import { listVehicleResponses } from './store-response';

type AttributeValue = AttributeValues[string];

type Field = {
  key: string;
  label: string;
  unit: string | null;
  options: { key: string; label: string }[];
};

type ConflictPart = {
  category_id: string | null;
  attributes: AttributeValues;
};

type ConflictVehicle = { label: string; requirements: VehicleRequirement[] };

export type RequirementConflict = {
  field_key: string;
  field: string;
  unit: string | null;
  value: string;
  options: string[] | null;
  min: number | null;
  max: number | null;
  vehicles: string[];
};

const optionLabel = (field: Field | undefined, key: string) =>
  field?.options.find((option) => option.key === key)?.label ?? key;

const shown = (field: Field | undefined, value: AttributeValue) =>
  (Array.isArray(value) ? value : [String(value)])
    .map((key) => (typeof value === 'number' ? key : optionLabel(field, key)))
    .join(', ');

export function requirementConflicts(
  part: ConflictPart,
  fields: Field[],
  vehicles: ConflictVehicle[],
): RequirementConflict[] {
  const conflicts = new Map<string, RequirementConflict>();
  for (const vehicle of vehicles) {
    for (const requirement of vehicle.requirements) {
      const value = part.attributes[requirement.field_key];
      if (
        requirement.category_id !== part.category_id ||
        value === undefined ||
        matchesRequirements(part.attributes, [requirement])
      ) {
        continue;
      }
      const { field_key, option_keys, min, max } = requirement;
      const key = JSON.stringify([field_key, option_keys, min, max]);
      const field = fields.find(({ key: fieldKey }) => fieldKey === field_key);
      const conflict = conflicts.get(key) ?? {
        field_key,
        field: field?.label ?? field_key,
        unit: field?.unit ?? null,
        value: shown(field, value),
        options:
          option_keys?.map((option) => optionLabel(field, option)) ?? null,
        min,
        max,
        vehicles: [],
      };
      conflict.vehicles.push(vehicle.label);
      conflicts.set(key, conflict);
    }
  }
  return [...conflicts.values()];
}

const conflictPartSchema = z.object({
  category_id: z.string().nullable(),
  attributes: attributeValuesSchema
    .nullable()
    .transform((value) => value ?? {}),
});

const fieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string().nullable(),
  options: z.array(z.object({ key: z.string(), label: z.string() })),
});

export async function fitmentConflicts(
  catalog: CatalogModuleService,
  partId: string,
  filter: VehicleFilter,
): Promise<RequirementConflict[]> {
  const part = conflictPartSchema.parse(await catalog.retrievePart(partId));
  if (!part.category_id) {
    return [];
  }
  const vehicleIds = (
    await catalog.listVehicles(
      filter.vehicle_id ? { id: filter.vehicle_id } : {},
      {
        relations: ['model', 'model.chassis', 'model.chassis.series', 'engine'],
        take: null,
      },
    )
  )
    .filter(matchesFilter(filter))
    .map(({ id }) => id);
  if (!vehicleIds.length) {
    return [];
  }
  const [vehicles, fields] = await Promise.all([
    listVehicleResponses(catalog, { id: vehicleIds }),
    catalog.listCategoryFields(
      { category_id: part.category_id },
      { relations: ['options'], take: null },
    ),
  ]);
  return requirementConflicts(
    part,
    z.array(fieldSchema).parse(fields),
    vehicles.map((vehicle) => ({
      label: carLabel(vehicle),
      requirements: vehicle.requirements,
    })),
  );
}

export async function refuseConflictingFitment(
  catalog: CatalogModuleService,
  partId: string,
  filter: VehicleFilter,
  confirmed: boolean | undefined,
): Promise<void> {
  if (confirmed) {
    return;
  }
  const conflicts = await fitmentConflicts(catalog, partId, filter);
  if (conflicts.length) {
    throw adminError(
      MedusaError.Types.CONFLICT,
      'REQUIREMENT_CONFLICT',
      'The Part contradicts the Requirements of some of these Vehicles',
      { conflicts },
    );
  }
}
