import type { Context } from '@medusajs/framework/types';
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from '@medusajs/framework/utils';
import {
  type AttributeValues,
  type CategoryFieldDefinition,
  type FitmentAxle,
  type FitmentSide,
  type GEARBOX_TYPES,
  guardDefinitionChange,
  type SteeringSide,
  normalizePartNumber,
  validateAttributes,
} from '@podbor/catalog-contract';

import Brand from './models/brand';
import BrandSpelling from './models/brand-spelling';
import Category from './models/category';
import CategoryField from './models/category-field';
import CategoryFieldOption from './models/category-field-option';
import Chassis from './models/chassis';
import Engine from './models/engine';
import Fitment from './models/fitment';
import Make from './models/make';
import Part from './models/part';
import PartIdentifier, {
  type PART_IDENTIFIER_TYPES,
} from './models/part-identifier';
import Series from './models/series';
import Vehicle from './models/vehicle';
import VehicleIdentifier from './models/vehicle-identifier';
import VehicleModel from './models/vehicle-model';

type Provenance = {
  source?: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export type NewPartIdentifier = {
  type: (typeof PART_IDENTIFIER_TYPES)[number];
  brand_id: string;
  value: string;
};

export type PartClassification = {
  category_id: string | null;
  attributes: Record<string, unknown>;
};

export type FitmentConditions = {
  quantity?: number;
  axle?: FitmentAxle | null;
  side?: FitmentSide | null;
  production_from?: Date | null;
  production_to?: Date | null;
  steering?: SteeringSide | null;
  gearbox?: (typeof GEARBOX_TYPES)[number] | null;
  note?: string | null;
};

export type VehicleFilter = {
  vehicle_id?: string;
  make_id?: string;
  series_id?: string;
  chassis_id?: string;
  model_id?: string;
  engine_id?: string;
  engine_family?: string;
  year_from?: number;
  year_to?: number;
};

type FilteredVehicle = {
  model_id: string;
  engine_id: string;
  year_from: number | null;
  year_to: number | null;
  engine: { family: string };
  model: {
    chassis_id: string;
    chassis: { series_id: string; series: { make_id: string } };
  };
};

const matchesFilter =
  (filter: VehicleFilter) =>
  ({ model, engine, ...vehicle }: FilteredVehicle): boolean =>
    [
      [filter.make_id, model.chassis.series.make_id],
      [filter.series_id, model.chassis.series_id],
      [filter.chassis_id, model.chassis_id],
      [filter.model_id, vehicle.model_id],
      [filter.engine_id, vehicle.engine_id],
      [filter.engine_family, engine.family],
    ].every(([wanted, actual]) => wanted === undefined || wanted === actual) &&
    (filter.year_from === undefined ||
      vehicle.year_to === null ||
      vehicle.year_to >= filter.year_from) &&
    (filter.year_to === undefined ||
      vehicle.year_from === null ||
      vehicle.year_from <= filter.year_to);

const time = (date: Date | null | undefined) => date?.getTime() ?? null;

const sameIdentity = (
  conditions: FitmentConditions,
  fitment: FitmentConditions,
): boolean =>
  (conditions.axle ?? null) === fitment.axle &&
  (conditions.side ?? null) === fitment.side &&
  (conditions.steering ?? null) === fitment.steering &&
  (conditions.gearbox ?? null) === fitment.gearbox &&
  time(conditions.production_from) === time(fitment.production_from) &&
  time(conditions.production_to) === time(fitment.production_to);

export type NewPart = Provenance &
  Partial<PartClassification> & {
    name: string;
    identifiers: NewPartIdentifier[];
  };

class CatalogModuleService extends MedusaService({
  Brand,
  BrandSpelling,
  Category,
  CategoryField,
  CategoryFieldOption,
  Make,
  Series,
  Chassis,
  VehicleModel,
  Engine,
  Part,
  PartIdentifier,
  Vehicle,
  VehicleIdentifier,
  Fitment,
}) {
  @InjectTransactionManager()
  async createPartWithIdentifiers(
    {
      name,
      identifiers,
      category_id = null,
      attributes = {},
      ...provenance
    }: NewPart,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<string> {
    const created = await this.createParts(
      {
        name,
        category_id,
        attributes: await this.validatePartAttributes(
          category_id,
          attributes,
          sharedContext,
        ),
        ...provenance,
      },
      sharedContext,
    );
    await this.createPartIdentifiers(
      identifiers.map((identifier) => ({
        ...identifier,
        normalized_value: normalizePartNumber(identifier.value),
        part_id: created.id,
        ...provenance,
      })),
      sharedContext,
    );
    return created.id;
  }

  @InjectTransactionManager()
  async attachPartToVehicles(
    partId: string,
    filter: VehicleFilter,
    conditions: FitmentConditions & Provenance,
    @MedusaContext() sharedContext: Context = {},
  ) {
    await this.retrievePart(partId, {}, sharedContext);
    const vehicles = (
      await this.listVehicles(
        filter.vehicle_id ? { id: filter.vehicle_id } : {},
        {
          relations: [
            'model',
            'model.chassis',
            'model.chassis.series',
            'engine',
          ],
          take: null,
        },
        sharedContext,
      )
    ).filter(matchesFilter(filter));
    const existing = await this.listFitments(
      { part_id: partId, vehicle_id: vehicles.map(({ id }) => id) },
      { take: null },
      sharedContext,
    );
    const missing = vehicles.filter(
      ({ id }) =>
        !existing.some(
          (fitment) =>
            fitment.vehicle_id === id && sameIdentity(conditions, fitment),
        ),
    );
    const created = missing.length
      ? await this.createFitments(
          missing.map(({ id }) => ({
            ...conditions,
            part_id: partId,
            vehicle_id: id,
          })),
          sharedContext,
        )
      : [];
    return { matched: vehicles.length, created };
  }

  @InjectTransactionManager()
  async replacePart(
    partId: string,
    replacedById: string | null,
    updatedBy: string | null,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    await this.retrievePart(partId, {}, sharedContext);
    for (let next = replacedById; next;) {
      if (next === partId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          'Replacement would close a cycle',
        );
      }
      next = (await this.retrievePart(next, {}, sharedContext)).replaced_by_id;
    }
    await this.updateParts(
      { id: partId, replaced_by_id: replacedById, updated_by: updatedBy },
      sharedContext,
    );
  }

  @InjectManager()
  async categoryDefinition(
    categoryId: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<CategoryFieldDefinition[]> {
    const fields = await this.listCategoryFields(
      { category_id: categoryId },
      { relations: ['options'] },
      sharedContext,
    );
    return fields.map(({ key, type, required, options }) => ({
      key,
      type,
      required,
      options: options.map((option) => ({ key: option.key })),
    }));
  }

  @InjectManager()
  async validatePartAttributes(
    categoryId: string | null,
    values: unknown,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<AttributeValues> {
    if (categoryId) {
      await this.retrieveCategory(categoryId, {}, sharedContext);
    }
    const fields = categoryId
      ? await this.categoryDefinition(categoryId, sharedContext)
      : [];
    const result = validateAttributes(fields, values);
    if (!result.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Attributes break the Category definition: ${result.errors.join('; ')}`,
      );
    }
    return result.values;
  }

  @InjectTransactionManager()
  async classifyPart(
    partId: string,
    { category_id, attributes, ...provenance }: PartClassification & Provenance,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    await this.updateParts(
      {
        id: partId,
        category_id,
        attributes: await this.validatePartAttributes(
          category_id,
          attributes,
          sharedContext,
        ),
        ...provenance,
      },
      sharedContext,
    );
  }

  @InjectManager()
  async guardCategoryDefinition(
    categoryId: string,
    change: (fields: CategoryFieldDefinition[]) => CategoryFieldDefinition[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const parts = await this.listParts(
      { category_id: categoryId },
      { select: ['id', 'attributes'] },
      sharedContext,
    );
    const broken = guardDefinitionChange(
      change(await this.categoryDefinition(categoryId, sharedContext)),
      parts,
    );
    if (broken.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `The change would break ${broken.length} parts in this Category`,
      );
    }
  }
}

export default CatalogModuleService;
