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
  requirementErrors,
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
import Requirement from './models/requirement';
import PartIdentifier, {
  type PART_IDENTIFIER_TYPES,
} from './models/part-identifier';
import Series from './models/series';
import Vehicle from './models/vehicle';
import VehicleIdentifier from './models/vehicle-identifier';
import VehicleModel from './models/vehicle-model';
import { adminError, alreadyExists } from '../../lib/admin-errors';

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

export type NewRequirement = Provenance & {
  field_id: string;
  engine_id?: string;
  chassis_id?: string;
  vehicle_id?: string;
  option_keys: string[] | null;
  min: number | null;
  max: number | null;
  quantity: number;
};

export type NewPart = Provenance &
  Partial<PartClassification> & {
    name: string;
    identifiers: NewPartIdentifier[];
  };

type SourcedRow = { id: string; source: string };

type SourcedRows = {
  list: (
    filters: { source?: string },
    context: Context,
  ) => Promise<SourcedRow[]>;
  remove: (ids: string[], context: Context) => Promise<void>;
};

export type SourceCount = { source: string; rows: number };

const SOURCE_COLUMNS = { select: ['id', 'source'], take: null };

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
  Requirement,
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
    await this.refuseUnknownBrands(identifiers, sharedContext);
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
  async addPartIdentifier(
    partId: string,
    identifier: NewPartIdentifier,
    provenance: Provenance,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    await this.retrievePart(partId, { select: ['id'] }, sharedContext);
    await this.refuseUnknownBrands([identifier], sharedContext);
    await this.createPartIdentifiers(
      {
        ...identifier,
        normalized_value: normalizePartNumber(identifier.value),
        part_id: partId,
        ...provenance,
      },
      sharedContext,
    );
  }

  @InjectTransactionManager()
  async removePartIdentifier(
    id: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const { part_id } = await this.retrievePartIdentifier(
      id,
      { select: ['part_id'] },
      sharedContext,
    );
    const [, count] = await this.listAndCountPartIdentifiers(
      { part_id },
      { select: ['id'], take: 1 },
      sharedContext,
    );
    if (count < 2) {
      throw adminError(
        MedusaError.Types.CONFLICT,
        'LAST_IDENTIFIER',
        'A Part keeps at least one number; delete the Part instead',
      );
    }
    await this.deletePartIdentifiers(id, sharedContext);
  }

  private async refuseUnknownBrands(
    identifiers: NewPartIdentifier[],
    sharedContext: Context,
  ): Promise<void> {
    const brandIds = [...new Set(identifiers.map(({ brand_id }) => brand_id))];
    const brands = await this.listBrands(
      { id: brandIds },
      { select: ['id'] },
      sharedContext,
    );
    if (brands.length !== brandIds.length) {
      throw adminError(
        MedusaError.Types.INVALID_DATA,
        'UNKNOWN_BRAND',
        'Unknown brand',
      );
    }
  }

  @InjectTransactionManager()
  async attachPartToVehicles(
    partId: string,
    filter: VehicleFilter,
    conditions: FitmentConditions & Provenance,
    @MedusaContext() sharedContext: Context = {},
  ) {
    await this.retrievePart(partId, {}, sharedContext);
    const vehicles = await this.filteredVehicles(filter, sharedContext);
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
  async detachPartFromVehicles(
    partId: string,
    filter: VehicleFilter,
    @MedusaContext() sharedContext: Context = {},
  ) {
    await this.retrievePart(partId, {}, sharedContext);
    const vehicles = await this.filteredVehicles(filter, sharedContext);
    const fitments = vehicles.length
      ? await this.listFitments(
          { part_id: partId, vehicle_id: vehicles.map(({ id }) => id) },
          { select: ['id'], take: null },
          sharedContext,
        )
      : [];
    if (fitments.length) {
      await this.deleteFitments(
        fitments.map(({ id }) => id),
        sharedContext,
      );
    }
    return { matched: vehicles.length, deleted: fitments.length };
  }

  private async filteredVehicles(
    filter: VehicleFilter,
    sharedContext: Context,
  ) {
    return (
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
        throw adminError(
          MedusaError.Types.INVALID_DATA,
          'REPLACEMENT_CYCLE',
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
      { relations: ['options'], take: null },
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
      const [key] = result.fields;
      const [field] =
        key && categoryId
          ? await this.listCategoryFields(
              { category_id: categoryId, key },
              { select: ['label'] },
              sharedContext,
            )
          : [];
      throw adminError(
        MedusaError.Types.INVALID_DATA,
        'INVALID_ATTRIBUTES',
        `Attributes break the Category definition: ${result.errors.join('; ')}`,
        { ...(key && { field: key }), ...(field && { label: field.label }) },
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

  @InjectTransactionManager()
  async createRequirement(
    requirement: NewRequirement,
    @MedusaContext() sharedContext: Context = {},
  ) {
    const field = await this.retrieveCategoryField(
      requirement.field_id,
      { relations: ['options'] },
      sharedContext,
    );
    const errors = requirementErrors(field, requirement);
    if (errors.length) {
      throw adminError(
        MedusaError.Types.INVALID_DATA,
        'INVALID_REQUIREMENT',
        `Requirement breaks its field: ${errors.join('; ')}`,
      );
    }
    const owner = {
      engine_id: requirement.engine_id ?? null,
      chassis_id: requirement.chassis_id ?? null,
      vehicle_id: requirement.vehicle_id ?? null,
    };
    const siblings = await this.listRequirements(
      { field_id: requirement.field_id, ...owner },
      { take: null },
      sharedContext,
    );
    const sameOptions = (keys: string[] | null) =>
      [...(keys ?? [])].sort().join() ===
      [...(requirement.option_keys ?? [])].sort().join();
    if (
      siblings.some(
        (sibling) =>
          sameOptions(sibling.option_keys) &&
          sibling.min === requirement.min &&
          sibling.max === requirement.max,
      )
    ) {
      throw alreadyExists(
        'requirement',
        'The owner already has this Requirement',
      );
    }
    return this.createRequirements(requirement, sharedContext);
  }

  @InjectManager()
  async guardRequirementUse(
    fieldId: string,
    optionKey: string | null,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const used = (
      await this.listRequirements(
        { field_id: fieldId },
        { select: ['id', 'option_keys'], take: null },
        sharedContext,
      )
    ).filter(
      ({ option_keys }) =>
        optionKey === null || option_keys?.includes(optionKey),
    );
    if (used.length) {
      throw adminError(
        MedusaError.Types.NOT_ALLOWED,
        'REQUIREMENT_IN_USE',
        `${used.length} Requirements use it`,
      );
    }
  }

  private sourcedRows(): SourcedRows[] {
    return [
      {
        list: (filters, context) =>
          this.listRequirements(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteRequirements(ids, context),
      },
      {
        list: (filters, context) =>
          this.listFitments(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteFitments(ids, context),
      },
      {
        list: (filters, context) =>
          this.listVehicleIdentifiers(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteVehicleIdentifiers(ids, context),
      },
      {
        list: (filters, context) =>
          this.listBrandSpellings(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteBrandSpellings(ids, context),
      },
      {
        list: (filters, context) =>
          this.listPartIdentifiers(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deletePartIdentifiers(ids, context),
      },
      {
        list: (filters, context) =>
          this.listParts(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteParts(ids, context),
      },
      {
        list: (filters, context) =>
          this.listVehicles(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteVehicles(ids, context),
      },
      {
        list: (filters, context) =>
          this.listCategoryFieldOptions(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteCategoryFieldOptions(ids, context),
      },
      {
        list: (filters, context) =>
          this.listCategoryFields(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteCategoryFields(ids, context),
      },
      {
        list: (filters, context) =>
          this.listCategories(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteCategories(ids, context),
      },
      {
        list: (filters, context) =>
          this.listVehicleModels(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteVehicleModels(ids, context),
      },
      {
        list: (filters, context) =>
          this.listEngines(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteEngines(ids, context),
      },
      {
        list: (filters, context) =>
          this.listChassis(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteChassis(ids, context),
      },
      {
        list: (filters, context) =>
          this.listSeries(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteSeries(ids, context),
      },
      {
        list: (filters, context) =>
          this.listMakes(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteMakes(ids, context),
      },
      {
        list: (filters, context) =>
          this.listBrands(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteBrands(ids, context),
      },
    ];
  }

  @InjectManager()
  async countRowsBySource(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<SourceCount[]> {
    const counts = new Map<string, number>();
    for (const { list } of this.sourcedRows()) {
      for (const { source } of await list({}, sharedContext)) {
        counts.set(source, (counts.get(source) ?? 0) + 1);
      }
    }
    return [...counts]
      .map(([source, rows]) => ({ source, rows }))
      .sort((a, b) => a.source.localeCompare(b.source));
  }

  // TODO: counts every catalogue row twice; count per table in SQL once catalogues reach hundreds of thousands of rows.
  @InjectTransactionManager()
  async deleteRowsBySource(
    source: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<number> {
    const othersBefore = await this.otherSourceRows(source, sharedContext);
    let deleted = 0;
    for (const { list, remove } of this.sourcedRows()) {
      const ids = (await list({ source }, sharedContext)).map(({ id }) => id);
      if (ids.length) {
        await remove(ids, sharedContext);
        deleted += ids.length;
      }
    }
    if ((await this.otherSourceRows(source, sharedContext)) !== othersBefore) {
      throw adminError(
        MedusaError.Types.NOT_ALLOWED,
        'SOURCE_IN_USE',
        `Rows of other sources still use rows of ${source}`,
      );
    }
    return deleted;
  }

  private async otherSourceRows(
    source: string,
    sharedContext: Context,
  ): Promise<number> {
    return (await this.countRowsBySource(sharedContext))
      .filter((count) => count.source !== source)
      .reduce((total, { rows }) => total + rows, 0);
  }

  @InjectManager()
  async guardCategoryDefinition(
    categoryId: string,
    change: (fields: CategoryFieldDefinition[]) => CategoryFieldDefinition[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const parts = await this.listParts(
      { category_id: categoryId },
      { select: ['id', 'attributes'], take: null },
      sharedContext,
    );
    const broken = guardDefinitionChange(
      change(await this.categoryDefinition(categoryId, sharedContext)),
      parts,
    );
    if (broken.length) {
      throw adminError(
        MedusaError.Types.NOT_ALLOWED,
        'DEFINITION_BREAKS_PARTS',
        `The change would break ${broken.length} parts in this Category`,
      );
    }
  }
}

export default CatalogModuleService;
