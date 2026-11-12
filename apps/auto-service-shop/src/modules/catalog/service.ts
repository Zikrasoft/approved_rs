import { isDeepStrictEqual } from 'node:util';

import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';
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
  type VEHICLE_DRIVES,
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
import MakeSpelling from './models/make-spelling';
import Part from './models/part';
import RejectedNumber from './models/rejected-number';
import Requirement from './models/requirement';
import PartIdentifier, {
  type PART_IDENTIFIER_TYPES,
} from './models/part-identifier';
import Series from './models/series';
import SlugRedirect, { type SlugKind } from './models/slug-redirect';
import Vehicle from './models/vehicle';
import VehicleIdentifier from './models/vehicle-identifier';
import VehicleModel from './models/vehicle-model';
import { adminError, alreadyExists } from '../_shared/admin-error';
import { runBoundSql } from '../_shared/bound-sql';
import { chunksOf } from '../_shared/chunks';
import { keysetPages } from '../_shared/keyset-pages';
import { modelSlugOf, slugOf, vehicleSlugOf } from '../_shared/slug';
import { nameKey, partNumberKey } from '../_shared/keys';
import {
  countRowsBySource,
  lockSourcedRows,
  refuseForeignHolders,
  refuseManualSource,
  refusingSourceUse,
  type SourceCount,
  sourcedRowsOf,
} from './by-source';
import { mergeMakes, type MergeSteps } from './merge';
import {
  identifierStatusRows,
  type IdentifierStatusFilters,
} from './identifier-status';
import {
  SLUG_COLUMNS,
  RETIRING_DELETES,
  scopedKind,
  slugScopeOf,
  MODELS_LEAVING_THEIR_MAKE,
  type MovedModel,
  slugInUse,
  reservedSection,
  refuseReservedSection,
  type SluggedKind,
  type SlugInput,
  type SluggedRow,
  type Retirement,
  type RetiringTable,
  retirementOf,
} from './slugs';

export type Provenance = {
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

export type PartEdit = {
  name?: string;
  description?: string | null;
  installation_price?: number | null;
  no_installation?: boolean;
  category_id?: string | null;
  attributes?: Record<string, unknown>;
  replaced_by_id?: string | null;
};

export type SourceChange = {
  name?: string;
  source_name?: string | null;
  description?: string;
  classification?: PartClassification;
};

export type AppliedSourceChange = { changed: boolean };

const STAFF_OWNED_FIELDS = [
  'name',
  'description',
  'category_id',
  'attributes',
] as const;

const definedOf = <Row extends object>(row: Row): Partial<Row> =>
  Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined),
  ) as Partial<Row>;

type DefinitionChange = (
  fields: CategoryFieldDefinition[],
) => CategoryFieldDefinition[];

type NewCategoryField = {
  category_id: string;
  key: string;
  type: CategoryFieldDefinition['type'];
  required?: boolean;
} & Record<string, unknown>;

type CategoryFieldUpdate = {
  id: string;
  type?: CategoryFieldDefinition['type'];
  required?: boolean;
} & Record<string, unknown>;

type DefinitionRemoval = {
  category_id: string;
  field_id: string;
  field: string;
  option: string | null;
};

const fieldRemoval = (field: {
  id: string;
  key: string;
  category_id: string;
}): DefinitionRemoval => ({
  category_id: field.category_id,
  field_id: field.id,
  field: field.key,
  option: null,
});

const optionRemoval = (option: {
  key: string;
  field_id: string;
  field: { key: string; category_id: string };
}): DefinitionRemoval => ({
  category_id: option.field.category_id,
  field_id: option.field_id,
  field: option.field.key,
  option: option.key,
});

const changesPerCategory = <Row extends { category_id: string }>(
  rows: Row[],
  change: (
    row: Row,
  ) => (field: CategoryFieldDefinition) => CategoryFieldDefinition[],
): Map<string, DefinitionChange> => {
  const changes = new Map<string, DefinitionChange>();
  for (const row of rows) {
    const previous = changes.get(row.category_id) ?? ((fields) => fields);
    changes.set(row.category_id, (fields) =>
      previous(fields).flatMap(change(row)),
    );
  }
  return changes;
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
  engine_id: string | null;
  year_from: number | null;
  year_to: number | null;
  engine: { family: string } | null;
  model: {
    chassis_id: string;
    chassis: { series_id: string; series: { make_id: string } };
  };
};

export const matchesFilter =
  (filter: VehicleFilter) =>
  ({ model, engine, ...vehicle }: FilteredVehicle): boolean =>
    [
      [filter.make_id, model.chassis.series.make_id],
      [filter.series_id, model.chassis.series_id],
      [filter.chassis_id, model.chassis_id],
      [filter.model_id, vehicle.model_id],
      [filter.engine_id, vehicle.engine_id],
      [filter.engine_family, engine?.family],
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

const VEHICLE_IDENTITY = [
  'model_id',
  'engine_id',
  'power_kw',
  'drive',
  'market',
  'year_from',
  'year_to',
  'steering',
] as const;

export type NewVehicle = Provenance & {
  model_id: string;
  engine_id: string | null;
  power_kw?: number | null;
  drive?: (typeof VEHICLE_DRIVES)[number] | null;
  market?: string | null;
  year_from?: number | null;
  year_to?: number | null;
  steering?: SteeringSide | null;
};

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
    description?: string | null;
    source_name?: string | null;
    source_url?: string | null;
    identifiers: NewPartIdentifier[];
  };

export type NewNumberedPart = Omit<NewPart, 'identifiers'> & {
  identifier: NewPartIdentifier;
};

export type FoundPart = {
  part_id: string;
  part_identifier_id: string;
  created: boolean;
};

const FLAG_UNLISTED_PARTS = `
  with listed as (
    select p.id, p.source_url, p.source_missing_since is not null as flagged,
      not exists (
        select 1 from part_identifier pi
        where pi.part_id = p.id and pi.deleted_at is null
          and pi.brand_id || ' ' || pi.normalized_value = any(?::text[])
      ) as missing
    from part p where p.source = ? and p.deleted_at is null
  )
  update part p
  set source_missing_since = case when l.missing then now() end,
    updated_at = now()
  from listed l
  where p.id = l.id and l.missing <> l.flagged and (
    not l.missing or case
      when l.source_url is null then ?::boolean
      else not (l.source_url = any(?::text[]))
    end
  )`;

const LOCK_SOURCED_VEHICLES = `
  select id from vehicle
  where id = any(?::text[]) and source = ? and deleted_at is null
  for update`;

const UNHELD_VEHICLES = `
  select v.id from vehicle v
  where v.id = any(?::text[]) and v.source = ? and v.deleted_at is null
    and not exists (select 1 from fitment f where f.vehicle_id = v.id)
    and not exists (
      select 1 from requirement r
      where r.vehicle_id = v.id and r.deleted_at is null
    )
    and not exists (
      select 1 from vehicle_identifier i
      where i.vehicle_id = v.id and i.supplier_id is null
        and i.deleted_at is null
    )`;

const CatalogModuleBase = MedusaService({
  Brand,
  BrandSpelling,
  Category,
  CategoryField,
  CategoryFieldOption,
  Make,
  MakeSpelling,
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
  RejectedNumber,
  SlugRedirect,
});

type CatalogModuleBase = InstanceType<typeof CatalogModuleBase>;

type SpellingInput = { value: string } & Record<string, unknown>;

const withValueKey = (row: SpellingInput) => ({
  ...row,
  value_key: nameKey(row.value),
});

class CatalogModuleService extends CatalogModuleBase {
  private sluggedRows(kind: SluggedKind) {
    const rows = {
      brand: {
        list: (filter: object, context: Context) =>
          this.listBrands(filter, SLUG_COLUMNS, context),
        update: (data: SlugInput, context: Context) =>
          this.updateBrands(data, context),
      },
      make: {
        list: (filter: object, context: Context) =>
          this.listMakes(filter, SLUG_COLUMNS, context),
        update: (data: SlugInput, context: Context) =>
          this.updateMakes(data, context),
      },
      model: {
        list: (filter: object, context: Context) =>
          this.listVehicleModels(filter, SLUG_COLUMNS, context),
        update: (data: SlugInput, context: Context) =>
          this.updateVehicleModels(data, context),
      },
      vehicle: {
        list: (filter: object, context: Context) =>
          this.listVehicles(filter, SLUG_COLUMNS, context),
        update: (data: SlugInput, context: Context) =>
          this.updateVehicles(data, context),
      },
      category: {
        list: (filter: object, context: Context) =>
          this.listCategories(filter, SLUG_COLUMNS, context),
        update: (data: SlugInput, context: Context) =>
          this.updateCategories(data, context),
      },
    };
    return rows[kind] as {
      list: (filter: object, context: Context) => Promise<SluggedRow[]>;
      update: (data: SlugInput, context: Context) => Promise<unknown>;
    };
  }

  private async slugRetired(
    kind: SluggedKind,
    slug: string,
    scopeId: string | null,
    context: Context,
  ): Promise<boolean> {
    const [, retired] = await this.listAndCountSlugRedirects(
      {
        kind,
        from_slug: slug,
        ...(scopedKind(kind) && { scope_id: scopeId }),
      },
      { select: ['id'], take: 1 },
      context,
    );
    return retired > 0;
  }

  private async slugTaken(
    kind: SluggedKind,
    slug: string,
    scopeId: string | null,
    context: Context,
  ): Promise<boolean> {
    const scope =
      kind === 'vehicle'
        ? { model_id: scopeId }
        : kind === 'model'
          ? { make_id: scopeId }
          : {};
    const live = await this.sluggedRows(kind).list({ slug, ...scope }, context);
    return (
      live.length > 0 || (await this.slugRetired(kind, slug, scopeId, context))
    );
  }

  private async baseSlug(
    kind: SluggedKind,
    row: SlugInput,
    context: Context,
  ): Promise<string> {
    if (kind === 'model') {
      const chassis = await this.retrieveChassis(
        String(row.chassis_id),
        { relations: ['series.make'] },
        context,
      );
      return modelSlugOf({
        make: chassis.series.make.name,
        series: chassis.series.name,
        chassis: chassis.code,
        model: String(row.name),
      });
    }
    if (kind === 'vehicle') {
      const engine =
        typeof row.engine_id === 'string'
          ? await this.retrieveEngine(
              row.engine_id,
              { select: ['code'] },
              context,
            )
          : null;
      const model = engine
        ? null
        : await this.retrieveVehicleModel(
            String(row.model_id),
            { select: ['name'] },
            context,
          );
      return vehicleSlugOf({
        engine: engine?.code ?? null,
        variant: model?.name ?? '',
        power_kw: typeof row.power_kw === 'number' ? row.power_kw : null,
      });
    }
    return slugOf(String(row.name));
  }

  private async slugFor(
    kind: SluggedKind,
    row: SlugInput,
    reserved: Set<string>,
    context: Context,
  ): Promise<string> {
    const scope = slugScopeOf(kind, row);
    const free = async (slug: string) =>
      !reserved.has(`${scope}/${slug}`) &&
      !reservedSection(kind, slug) &&
      !(await this.slugTaken(kind, slug, scope, context));
    if (row.slug !== undefined) {
      refuseReservedSection(kind, row.slug);
      if (await this.slugRetired(kind, row.slug, scope, context)) {
        throw slugInUse();
      }
      return row.slug;
    }
    const base = await this.baseSlug(kind, row, context);
    if (!base) {
      throw adminError(
        MedusaError.Types.INVALID_DATA,
        'NO_SLUG',
        `${String(row.name ?? kind)} has no Latin letters or digits for its slug`,
      );
    }
    for (let attempt = 1; ; attempt += 1) {
      const slug = attempt > 1 ? `${base}-${attempt}` : base;
      if (await free(slug)) return slug;
    }
  }

  private async withSlugs<Data extends SlugInput | SlugInput[]>(
    kind: SluggedKind,
    data: Data,
    context: Context = {},
  ): Promise<Data> {
    const reserved = new Set<string>();
    const slugged: SlugInput[] = [];
    for (const input of [data].flat()) {
      const row =
        kind === 'model' ? await this.withModelMake(input, context) : input;
      const slug = await this.slugFor(kind, row, reserved, context);
      reserved.add(`${slugScopeOf(kind, row)}/${slug}`);
      slugged.push({ ...row, slug });
    }
    return (Array.isArray(data) ? slugged : slugged[0]) as Data;
  }

  private async withModelMake(
    row: SlugInput,
    context: Context,
  ): Promise<SlugInput> {
    const chassis = await this.retrieveChassis(
      String(row.chassis_id),
      { relations: ['series'] },
      context,
    );
    return { ...row, make_id: chassis.series.make_id };
  }

  @InjectTransactionManager()
  private async updateFollowingMakes(
    method: 'updateSeries' | 'updateChassis' | 'updateVehicleModels',
    data: unknown,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<unknown> {
    const updated: unknown = await (
      CatalogModuleBase.prototype[method] as (
        data: unknown,
        context: Context,
      ) => Promise<unknown>
    ).call(this, data, sharedContext);
    await this.flush(sharedContext);
    const ids = [updated].flat().map((row) => (row as { id: string }).id);
    const { rows }: { rows: MovedModel[] } = await runBoundSql(
      sharedContext,
      MODELS_LEAVING_THEIR_MAKE[method],
      [ids],
    );
    for (const model of rows) {
      await this.moveModel(model, sharedContext);
    }
    return updated;
  }

  private async moveModel(
    { id, slug, chassis_id, name, from_make, to_make }: MovedModel,
    context: Context,
  ): Promise<void> {
    const moved = { chassis_id, name, make_id: to_make };
    const free = !(await this.slugTaken('model', slug, to_make, context));
    await CatalogModuleBase.prototype.updateVehicleModels.call(
      this,
      {
        id,
        make_id: to_make,
        slug: free
          ? slug
          : await this.slugFor('model', moved, new Set(), context),
      },
      context,
    );
    await this.createSlugRedirects(
      {
        kind: 'model',
        from_id: id,
        from_slug: slug,
        scope_id: from_make,
        target_kind: 'model',
        target_id: id,
      },
      context,
    );
  }

  override updateSeries = ((data: unknown, context?: Context) =>
    this.updateFollowingMakes(
      'updateSeries',
      data,
      context,
    )) as CatalogModuleBase['updateSeries'];

  override updateChassis = ((data: unknown, context?: Context) =>
    this.updateFollowingMakes(
      'updateChassis',
      data,
      context,
    )) as CatalogModuleBase['updateChassis'];

  override updateVehicleModels = ((data: unknown, context?: Context) =>
    this.updateFollowingMakes(
      'updateVehicleModels',
      data,
      context,
    )) as CatalogModuleBase['updateVehicleModels'];

  override createBrands = ((data: SlugInput | SlugInput[], context?: Context) =>
    this.withSlugs('brand', data, context).then((slugged) =>
      CatalogModuleBase.prototype.createBrands.call(this, slugged, context),
    )) as CatalogModuleBase['createBrands'];

  override createMakes = ((data: SlugInput | SlugInput[], context?: Context) =>
    this.withSlugs('make', data, context).then((slugged) =>
      CatalogModuleBase.prototype.createMakes.call(this, slugged, context),
    )) as CatalogModuleBase['createMakes'];

  override createVehicleModels = ((
    data: SlugInput | SlugInput[],
    context?: Context,
  ) =>
    this.withSlugs('model', data, context).then((slugged) =>
      CatalogModuleBase.prototype.createVehicleModels.call(
        this,
        slugged,
        context,
      ),
    )) as CatalogModuleBase['createVehicleModels'];

  override createVehicles = ((
    data: SlugInput | SlugInput[],
    context?: Context,
  ) =>
    this.withSlugs('vehicle', data, context).then((slugged) =>
      CatalogModuleBase.prototype.createVehicles.call(this, slugged, context),
    )) as CatalogModuleBase['createVehicles'];

  override createCategories = ((
    data: SlugInput | SlugInput[],
    context?: Context,
  ) =>
    this.withSlugs('category', data, context).then((slugged) =>
      CatalogModuleBase.prototype.createCategories.call(this, slugged, context),
    )) as CatalogModuleBase['createCategories'];

  private async slugScope(
    kind: SluggedKind,
    id: string,
    context: Context,
  ): Promise<string | null> {
    if (kind === 'model') {
      return (
        await this.retrieveVehicleModel(id, { select: ['make_id'] }, context)
      ).make_id;
    }
    if (kind === 'vehicle') {
      return (await this.retrieveVehicle(id, { select: ['model_id'] }, context))
        .model_id;
    }
    return null;
  }

  @InjectTransactionManager()
  async renameSlug(
    kind: SluggedKind,
    id: string,
    slug: string,
    provenance: Provenance,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const rows = this.sluggedRows(kind);
    const [row] = await rows.list({ id }, sharedContext);
    if (!row) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `${kind} ${id} was not found`,
      );
    }
    if (row.slug === slug) return;
    refuseReservedSection(kind, slug);
    const scope = await this.slugScope(kind, id, sharedContext);
    if (await this.slugTaken(kind, slug, scope, sharedContext)) {
      throw slugInUse();
    }
    await rows.update(
      { id, slug, updated_by: provenance.updated_by },
      sharedContext,
    );
    await this.createSlugRedirects(
      {
        kind,
        from_id: id,
        from_slug: row.slug,
        scope_id: scope,
        target_kind: kind,
        target_id: id,
        ...provenance,
      },
      sharedContext,
    );
  }

  private async retireSlugs(
    kind: SlugKind,
    retired: Retirement[],
    context: Context,
    provenance: Provenance = {},
  ): Promise<void> {
    if (!retired.length) return;
    const byTarget = new Map<string, Retirement[]>();
    for (const row of retired) {
      const key = JSON.stringify([row.target_kind, row.target_id]);
      byTarget.set(key, [...(byTarget.get(key) ?? []), row]);
    }
    for (const group of byTarget.values()) {
      const [{ target_kind, target_id }] = group;
      await this.updateSlugRedirects(
        {
          selector: { target_kind: kind, target_id: group.map(({ id }) => id) },
          data: { target_kind, target_id },
        },
        context,
      );
    }
    if (kind === 'part') {
      await this.deleteSlugRedirects(
        { kind, from_slug: retired.map(({ slug }) => slug) },
        context,
      );
    }
    await this.createSlugRedirects(
      retired.map(({ id, slug, ...rest }) => ({
        kind,
        from_id: id,
        from_slug: slug,
        ...rest,
        ...provenance,
      })),
      context,
    );
  }

  private mergeSteps(): MergeSteps {
    return {
      catalog: this,
      retireSlugs: (kind, retired, context, provenance) =>
        this.retireSlugs(kind, retired, context, provenance),
      vehicleSlugIn: async (vehicle, modelId, context) =>
        (await this.slugTaken('vehicle', vehicle.slug, modelId, context))
          ? this.slugFor(
              'vehicle',
              { ...vehicle, slug: undefined, model_id: modelId },
              new Set(),
              context,
            )
          : vehicle.slug,
      flush: (context) => this.flush(context),
      purgeMake: (id, context) =>
        CatalogModuleBase.prototype.deleteMakes.call(this, id, context),
      purgeModel: (id, context) =>
        CatalogModuleBase.prototype.deleteVehicleModels.call(this, id, context),
    };
  }

  @InjectTransactionManager()
  async mergeMakes(
    sourceId: string,
    targetId: string,
    provenance: Provenance,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    await mergeMakes(
      this.mergeSteps(),
      sourceId,
      targetId,
      provenance,
      sharedContext,
    );
  }

  private async retirementsOf(
    table: RetiringTable,
    ids: string[],
    context: Context,
  ): Promise<Retirement[]> {
    if (table === 'part_identifier' || table === 'part') {
      const identifiers = await this.listPartIdentifiers(
        table === 'part' ? { part_id: ids } : { id: ids },
        { relations: ['brand', 'part'], take: null },
        context,
      );
      return identifiers.map(retirementOf.part);
    }
    if (table === 'vehicle') {
      const vehicles = await this.listVehicles(
        { id: ids },
        { select: ['id', 'slug', 'model_id'], take: null },
        context,
      );
      return vehicles.map(retirementOf.vehicle);
    }
    if (table === 'model') {
      const models = await this.listVehicleModels(
        { id: ids },
        { select: ['id', 'slug', 'make_id'], take: null },
        context,
      );
      return models.map(retirementOf.model);
    }
    const rows = await this.sluggedRows(table).list({ id: ids }, context);
    return rows.map(retirementOf.unscoped);
  }

  @InjectTransactionManager()
  private async deleteRetiring(
    table: RetiringTable,
    ids: string | string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    for (const chunk of chunksOf([ids].flat())) {
      await this.retireSlugs(
        table === 'part_identifier' ? 'part' : table,
        await this.retirementsOf(table, chunk, sharedContext),
        sharedContext,
      );
      await CatalogModuleBase.prototype[RETIRING_DELETES[table]].call(
        this,
        chunk,
        sharedContext,
      );
    }
  }

  override deletePartIdentifiers = ((
    ids: string | string[],
    context?: Context,
  ) =>
    this.deleteRetiring(
      'part_identifier',
      ids,
      context,
    )) as CatalogModuleBase['deletePartIdentifiers'];

  override deleteParts = ((ids: string | string[], context?: Context) =>
    this.deleteRetiring(
      'part',
      ids,
      context,
    )) as CatalogModuleBase['deleteParts'];

  override deleteVehicles = ((ids: string | string[], context?: Context) =>
    this.deleteRetiring(
      'vehicle',
      ids,
      context,
    )) as CatalogModuleBase['deleteVehicles'];

  override deleteVehicleModels = ((ids: string | string[], context?: Context) =>
    this.deleteRetiring(
      'model',
      ids,
      context,
    )) as CatalogModuleBase['deleteVehicleModels'];

  override deleteMakes = ((ids: string | string[], context?: Context) =>
    this.deleteRetiring(
      'make',
      ids,
      context,
    )) as CatalogModuleBase['deleteMakes'];

  override deleteBrands = ((ids: string | string[], context?: Context) =>
    this.deleteRetiring(
      'brand',
      ids,
      context,
    )) as CatalogModuleBase['deleteBrands'];

  override deleteCategories = ((ids: string | string[], context?: Context) =>
    this.deleteRetiring(
      'category',
      ids,
      context,
    )) as CatalogModuleBase['deleteCategories'];

  @InjectTransactionManager()
  async createPartWithIdentifiers(
    {
      name,
      description = null,
      source_name = null,
      source_url = null,
      identifiers,
      category_id = null,
      attributes = {},
      ...provenance
    }: NewPart,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<string> {
    await this.refuseUnknownBrands(identifiers, sharedContext);
    await this.lockNumbers(identifiers, sharedContext);
    await this.refuseTakenNumbers(identifiers, sharedContext);
    await this.takeBackRejectedNumbers(identifiers, sharedContext);
    const created = await this.createParts(
      {
        name,
        description,
        source_name,
        source_url,
        category_id,
        attributes: await this.classifiedAttributes(
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
        normalized_value: partNumberKey(identifier.value),
        part_id: created.id,
        ...provenance,
      })),
      sharedContext,
    );
    return created.id;
  }

  @InjectTransactionManager()
  async findOrCreatePart(
    { identifier, ...part }: NewNumberedPart,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<FoundPart> {
    await this.lockNumbers([identifier], sharedContext);
    const normalized = partNumberKey(identifier.value);
    const [existing] = await this.listPartIdentifiers(
      { brand_id: identifier.brand_id, normalized_value: normalized },
      { select: ['id', 'part_id'], take: 1 },
      sharedContext,
    );
    if (existing) {
      return {
        part_id: existing.part_id,
        part_identifier_id: existing.id,
        created: false,
      };
    }
    if (
      await this.isRejectedNumber(
        identifier.brand_id,
        identifier.value,
        sharedContext,
      )
    ) {
      throw adminError(
        MedusaError.Types.NOT_ALLOWED,
        'REJECTED_NUMBER',
        `${identifier.value} was deleted from the catalogue by staff`,
      );
    }
    const partId = await this.createPartWithIdentifiers(
      { ...part, identifiers: [identifier] },
      sharedContext,
    );
    const [created] = await this.listPartIdentifiers(
      { part_id: partId },
      { select: ['id'], take: 1 },
      sharedContext,
    );
    return { part_id: partId, part_identifier_id: created.id, created: true };
  }

  @InjectManager()
  async isRejectedNumber(
    brandId: string,
    value: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<boolean> {
    const [, count] = await this.listAndCountRejectedNumbers(
      { brand_id: brandId, normalized_value: partNumberKey(value) },
      { select: ['id'], take: 1 },
      sharedContext,
    );
    return count > 0;
  }

  @InjectTransactionManager()
  async deletePartRejectingNumbers(
    id: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const identifiers = await this.listPartIdentifiers(
      { part_id: id },
      { select: ['brand_id', 'normalized_value'], take: null },
      sharedContext,
    );
    const rejected = identifiers.length
      ? await this.listRejectedNumbers(
          {
            $or: identifiers.map(({ brand_id, normalized_value }) => ({
              brand_id,
              normalized_value,
            })),
          },
          { select: ['brand_id', 'normalized_value'], take: null },
          sharedContext,
        )
      : [];
    const known = new Set(
      rejected.map((row) => `${row.brand_id} ${row.normalized_value}`),
    );
    const fresh = identifiers.filter(
      (row) => !known.has(`${row.brand_id} ${row.normalized_value}`),
    );
    if (fresh.length) {
      await this.createRejectedNumbers(
        fresh.map(({ brand_id, normalized_value }) => ({
          brand_id,
          normalized_value,
        })),
        sharedContext,
      );
    }
    await this.deleteParts(id, sharedContext);
  }

  private async takeBackRejectedNumbers(
    identifiers: NewPartIdentifier[],
    context: Context,
  ): Promise<void> {
    const rejected = await this.listRejectedNumbers(
      {
        $or: identifiers.map(({ brand_id, value }) => ({
          brand_id,
          normalized_value: partNumberKey(value),
        })),
      },
      { select: ['id'], take: null },
      context,
    );
    if (rejected.length) {
      await this.softDeleteRejectedNumbers(
        rejected.map(({ id }) => id),
        {},
        context,
      );
    }
  }

  @InjectManager()
  async brandByAnyName(
    name: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<{ id: string; name: string; slug: string } | null> {
    const key = nameKey(name);
    const named = (
      await this.listBrands(
        {},
        { select: ['id', 'name', 'slug'], take: null },
        sharedContext,
      )
    ).find((brand) => nameKey(brand.name) === key);
    if (named) return named;
    const spellings = await this.listBrandSpellings(
      { value_key: key },
      { relations: ['brand'], take: null },
      sharedContext,
    );
    const spelled =
      spellings.find(({ supplier_id }) => supplier_id === null) ?? spellings[0];
    return spelled
      ? {
          id: spelled.brand.id,
          name: spelled.brand.name,
          slug: spelled.brand.slug,
        }
      : null;
  }

  @InjectTransactionManager()
  async transaction<T>(
    work: (context: Context) => Promise<T>,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<T> {
    return work(sharedContext);
  }

  override createBrandSpellings = ((
    data: SpellingInput | SpellingInput[],
    sharedContext?: Context,
  ) =>
    CatalogModuleBase.prototype.createBrandSpellings.call(
      this,
      Array.isArray(data) ? data.map(withValueKey) : withValueKey(data),
      sharedContext,
    )) as CatalogModuleBase['createBrandSpellings'];

  override createMakeSpellings = ((
    data: SpellingInput | SpellingInput[],
    sharedContext?: Context,
  ) =>
    CatalogModuleBase.prototype.createMakeSpellings.call(
      this,
      Array.isArray(data) ? data.map(withValueKey) : withValueKey(data),
      sharedContext,
    )) as CatalogModuleBase['createMakeSpellings'];

  @InjectTransactionManager()
  async createVehicleOnce(
    vehicle: NewVehicle,
    @MedusaContext() sharedContext: Context = {},
  ) {
    await this.lockRow('vehicle_model', vehicle.model_id, sharedContext);
    const [, identical] = await this.listAndCountVehicles(
      Object.fromEntries(
        VEHICLE_IDENTITY.map((column) => [column, vehicle[column] ?? null]),
      ),
      { select: ['id'], take: 1 },
      sharedContext,
    );
    if (identical) {
      throw alreadyExists('vehicle', 'This vehicle already exists.');
    }
    return this.createVehicles(vehicle, sharedContext);
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
    await this.lockNumbers([identifier], sharedContext);
    await this.refuseTakenNumbers([identifier], sharedContext);
    await this.takeBackRejectedNumbers([identifier], sharedContext);
    await this.createPartIdentifiers(
      {
        ...identifier,
        normalized_value: partNumberKey(identifier.value),
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
    await this.lockRow('part', part_id, sharedContext);
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

  private async flush(context: Context): Promise<void> {
    await (context.transactionManager as SqlEntityManager).flush();
  }

  private async lockRow(
    table: 'part' | 'vehicle_model' | 'category',
    id: string,
    sharedContext: Context,
    mode: 'update' | 'share' = 'update',
  ): Promise<void> {
    await (sharedContext.transactionManager as SqlEntityManager).execute(
      `select id from "${table}" where id = ? for ${mode}`,
      [id],
    );
  }

  private async lockNumbers(
    identifiers: NewPartIdentifier[],
    sharedContext: Context,
  ): Promise<void> {
    const keys = [
      ...new Set(
        identifiers.map(
          ({ brand_id, value }) => `${brand_id}:${partNumberKey(value)}`,
        ),
      ),
    ].sort();
    for (const key of keys) {
      await (sharedContext.transactionManager as SqlEntityManager).execute(
        'select pg_advisory_xact_lock(hashtextextended(?, 0))',
        [key],
      );
    }
  }

  private async refuseTakenNumbers(
    identifiers: NewPartIdentifier[],
    sharedContext: Context,
  ): Promise<void> {
    const [taken] = await this.listPartIdentifiers(
      {
        $or: identifiers.map(({ brand_id, value }) => ({
          brand_id,
          normalized_value: partNumberKey(value),
        })),
      },
      { relations: ['part'], take: 1 },
      sharedContext,
    );
    if (taken) {
      throw alreadyExists(
        'part_identifier',
        'This number already belongs to a Part.',
        { part: taken.part.name },
      );
    }
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
      await this.softDeleteFitments(
        fitments.map(({ id }) => id),
        {},
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
    await (sharedContext.transactionManager as SqlEntityManager).execute(
      "select pg_advisory_xact_lock(hashtextextended('part-replacement', 0))",
    );
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

  @InjectTransactionManager()
  async deleteOrphanVehicles(
    ids: string[],
    source: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    await runBoundSql(sharedContext, LOCK_SOURCED_VEHICLES, [ids, source]);
    const { rows }: { rows: { id: string }[] } = await runBoundSql(
      sharedContext,
      UNHELD_VEHICLES,
      [ids, source],
    );
    if (rows.length) {
      await this.deleteVehicles(
        rows.map(({ id }) => id),
        sharedContext,
      );
    }
  }

  @InjectTransactionManager()
  async flagUnlistedParts(
    source: string,
    listedBrandNumbers: string[],
    unreadableUrls: string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    await runBoundSql(sharedContext, FLAG_UNLISTED_PARTS, [
      listedBrandNumbers,
      source,
      unreadableUrls.length === 0,
      unreadableUrls,
    ]);
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

  private async classifiedAttributes(
    categoryId: string | null,
    attributes: unknown,
    sharedContext: Context,
  ): Promise<AttributeValues> {
    if (categoryId) {
      await this.lockRow('category', categoryId, sharedContext, 'share');
    }
    return this.validatePartAttributes(categoryId, attributes, sharedContext);
  }

  @InjectTransactionManager()
  async classifyPart(
    partId: string,
    { category_id, attributes, ...provenance }: PartClassification & Provenance,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const values = await this.classifiedAttributes(
      category_id,
      attributes,
      sharedContext,
    );
    await this.updateParts(
      { id: partId, category_id, ...provenance },
      sharedContext,
    );
    await (sharedContext.transactionManager as SqlEntityManager).execute(
      'update "part" set "attributes" = ? where "id" = ?',
      [JSON.stringify(values), partId],
    );
  }

  @InjectTransactionManager()
  async editPart(
    id: string,
    { category_id, attributes, replaced_by_id, ...columns }: PartEdit,
    updatedBy: string | null,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    await this.lockRow('part', id, sharedContext);
    const current = await this.retrievePart(
      id,
      { select: ['category_id', 'attributes', 'edited_fields'] },
      sharedContext,
    );
    const edit = { ...columns, category_id, attributes };
    await this.updateParts(
      {
        id,
        ...definedOf(columns),
        edited_fields: [
          ...new Set([
            ...current.edited_fields,
            ...STAFF_OWNED_FIELDS.filter((field) => edit[field] !== undefined),
          ]),
        ],
        updated_by: updatedBy,
      },
      sharedContext,
    );
    if (category_id !== undefined || attributes !== undefined) {
      const next =
        category_id === undefined ? current.category_id : category_id;
      await this.classifyPart(
        id,
        {
          category_id: next,
          attributes:
            attributes ??
            (next === current.category_id ? current.attributes : {}),
          updated_by: updatedBy,
        },
        sharedContext,
      );
    }
    if (replaced_by_id !== undefined) {
      await this.replacePart(id, replaced_by_id, updatedBy, sharedContext);
    }
  }

  @InjectTransactionManager()
  async applySourceChange(
    id: string,
    { classification, ...change }: SourceChange,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<AppliedSourceChange> {
    await this.lockRow('part', id, sharedContext);
    const part = await this.retrievePart(
      id,
      { select: ['category_id', 'attributes', 'description', 'edited_fields'] },
      sharedContext,
    );
    const owned = new Set(part.edited_fields);
    const columns = {
      ...(change.name !== undefined &&
        !owned.has('name') && {
          name: change.name,
          source_name: change.source_name ?? null,
        }),
      ...(change.description !== undefined &&
        !owned.has('description') &&
        !part.description && { description: change.description }),
    };
    const fileable = !part.category_id && !owned.has('category_id');
    const refreshable =
      Boolean(part.category_id) &&
      classification?.category_id === part.category_id &&
      !owned.has('attributes');
    const classified =
      classification && (fileable || refreshable)
        ? await this.classifyFromSource(id, classification, part, sharedContext)
        : false;
    const renamed = Object.keys(columns).length > 0;
    if (renamed) {
      await this.updateParts({ id, ...columns }, sharedContext);
    }
    return { changed: renamed || classified };
  }

  private async classifyFromSource(
    id: string,
    classification: PartClassification,
    current: PartClassification,
    sharedContext: Context,
  ): Promise<boolean> {
    if (!classification.category_id) return false;
    try {
      const values = await this.classifiedAttributes(
        classification.category_id,
        classification.attributes,
        sharedContext,
      );
      if (
        classification.category_id === current.category_id &&
        isDeepStrictEqual(values, current.attributes)
      ) {
        return false;
      }
      await this.classifyPart(id, classification, sharedContext);
      return true;
    } catch (error) {
      if (
        MedusaError.isMedusaError(error) &&
        error.code === 'INVALID_ATTRIBUTES'
      ) {
        return false;
      }
      throw error;
    }
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
    const [, siblings] = await this.listAndCountRequirements(
      { field_id: requirement.field_id, ...owner },
      { select: ['id'], take: 1 },
      sharedContext,
    );
    if (siblings) {
      throw alreadyExists(
        'requirement',
        'The owner already has a Requirement on this field',
      );
    }
    return this.createRequirements(requirement, sharedContext);
  }

  @InjectManager()
  async identifierStatusRows(
    filters: IdentifierStatusFilters,
    @MedusaContext() sharedContext: Context = {},
  ) {
    return identifierStatusRows(
      (
        (sharedContext.transactionManager ??
          sharedContext.manager) as SqlEntityManager
      ).getKnex(),
      filters,
    );
  }

  @InjectManager()
  async countRowsBySource(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<SourceCount[]> {
    return countRowsBySource(
      (sharedContext.transactionManager ??
        sharedContext.manager) as SqlEntityManager,
      sourcedRowsOf(this),
    );
  }

  @InjectManager()
  async deleteRowsBySource(
    source: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<number> {
    refuseManualSource(source);
    const tables = sourcedRowsOf(this);
    await this.transaction(async (context) => {
      for (const { entity } of tables) {
        await refuseForeignHolders(context, tables, entity, source);
      }
      await this.refuseDefinitionLoss(source, context);
    }, sharedContext);
    let deleted = 0;
    for (const { entity, list, remove } of tables) {
      for (let after = ''; ;) {
        const ids = await this.transaction(async (context) => {
          const chunk = (
            await list({ source, id: { $gt: after } }, context)
          ).map(({ id }) => id);
          if (chunk.length) {
            await lockSourcedRows(context, entity, chunk);
            await refuseForeignHolders(context, tables, entity, source, chunk);
            await remove(chunk, context).catch(
              refusingSourceUse(source, entity),
            );
          }
          return chunk;
        }, sharedContext);
        if (!ids.length) break;
        deleted += ids.length;
        after = ids[ids.length - 1];
      }
    }
    return deleted;
  }

  private async refuseDefinitionLoss(
    source: string,
    context: Context,
  ): Promise<void> {
    const fields = await this.listCategoryFields(
      { source },
      { select: ['id', 'key', 'category_id'], take: null },
      context,
    );
    const options = await this.listCategoryFieldOptions(
      { source },
      { relations: ['field'], take: null },
      context,
    );
    const losses: [string, DefinitionRemoval[]][] = [
      ['category_field', fields.map(fieldRemoval)],
      ['category_field_option', options.map(optionRemoval)],
    ];
    for (const [entity, removals] of losses) {
      await this.refuseRemovals(removals, context, source).catch(
        refusingSourceUse(source, entity),
      );
    }
  }

  private async refuseRemovals(
    removals: DefinitionRemoval[],
    sharedContext: Context,
    exceptSource?: string,
  ): Promise<void> {
    await this.refuseRequirementUse(removals, sharedContext, exceptSource);
    await this.refuseBrokenParts(
      changesPerCategory(
        removals,
        ({ field, option }) =>
          (definition) =>
            definition.key !== field
              ? [definition]
              : option === null
                ? []
                : [
                    {
                      ...definition,
                      options: definition.options.filter(
                        ({ key }) => key !== option,
                      ),
                    },
                  ],
      ),
      sharedContext,
      exceptSource,
    );
  }

  private async refuseRequirementUse(
    uses: { field_id: string; option: string | null }[],
    sharedContext: Context,
    exceptSource?: string,
  ): Promise<void> {
    if (!uses.length) return;
    const requirements = await this.listRequirements(
      {
        field_id: [...new Set(uses.map(({ field_id }) => field_id))],
        ...(exceptSource && { source: { $ne: exceptSource } }),
      },
      { select: ['id', 'field_id', 'option_keys'], take: null },
      sharedContext,
    );
    const used = requirements.filter((requirement) =>
      uses.some(
        ({ field_id, option }) =>
          requirement.field_id === field_id &&
          (option === null || requirement.option_keys?.includes(option)),
      ),
    );
    if (used.length) {
      throw adminError(
        MedusaError.Types.NOT_ALLOWED,
        'REQUIREMENT_IN_USE',
        `${used.length} Requirements use it`,
      );
    }
  }

  private async refuseBrokenParts(
    changes: Map<string, DefinitionChange>,
    sharedContext: Context,
    exceptSource?: string,
  ): Promise<void> {
    for (const categoryId of [...changes.keys()].sort()) {
      await this.lockRow('category', categoryId, sharedContext);
      const fields = changes.get(categoryId)!(
        await this.categoryDefinition(categoryId, sharedContext),
      );
      let broken = 0;
      for await (const parts of keysetPages((after, take) =>
        this.listParts(
          {
            category_id: categoryId,
            ...(exceptSource && { source: { $ne: exceptSource } }),
            ...(after && { id: { $gt: after } }),
          },
          { select: ['id', 'attributes'], order: { id: 'ASC' }, take },
          sharedContext,
        ),
      )) {
        broken += guardDefinitionChange(fields, parts).length;
      }
      if (broken) {
        throw adminError(
          MedusaError.Types.NOT_ALLOWED,
          'DEFINITION_BREAKS_PARTS',
          `The change would break ${broken} parts in this Category`,
        );
      }
    }
  }

  @InjectTransactionManager()
  private async createGuardedFields(
    data: NewCategoryField | NewCategoryField[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<unknown> {
    const changes = new Map<string, DefinitionChange>();
    for (const row of [data].flat()) {
      const previous = changes.get(row.category_id) ?? ((fields) => fields);
      changes.set(row.category_id, (fields) => [
        ...previous(fields),
        {
          key: row.key,
          type: row.type,
          required: row.required ?? false,
          options: [],
        },
      ]);
    }
    await this.refuseBrokenParts(changes, sharedContext);
    return CatalogModuleBase.prototype.createCategoryFields.call(
      this,
      data,
      sharedContext,
    );
  }

  @InjectTransactionManager()
  private async updateGuardedFields(
    data: CategoryFieldUpdate | CategoryFieldUpdate[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<unknown> {
    const rows = [data].flat();
    const stored = await this.listCategoryFields(
      { id: rows.map(({ id }) => id) },
      { select: ['id', 'key', 'type', 'category_id'], take: null },
      sharedContext,
    );
    const updates = stored.map((field) => ({
      ...field,
      update: rows.find(({ id }) => id === field.id)!,
    }));
    await this.refuseRequirementUse(
      updates
        .filter(({ type, update }) => update.type && update.type !== type)
        .map(({ id }) => ({ field_id: id, option: null })),
      sharedContext,
    );
    await this.refuseBrokenParts(
      changesPerCategory(updates, ({ key, update }) => (definition) => [
        definition.key === key
          ? {
              ...definition,
              type: update.type ?? definition.type,
              required: update.required ?? definition.required,
            }
          : definition,
      ]),
      sharedContext,
    );
    return CatalogModuleBase.prototype.updateCategoryFields.call(
      this,
      data,
      sharedContext,
    );
  }

  @InjectTransactionManager()
  private async deleteGuardedFields(
    ids: string | string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const fields = await this.listCategoryFields(
      { id: [ids].flat() },
      { select: ['id', 'key', 'category_id'], take: null },
      sharedContext,
    );
    await this.refuseRemovals(fields.map(fieldRemoval), sharedContext);
    await CatalogModuleBase.prototype.deleteCategoryFields.call(
      this,
      ids,
      sharedContext,
    );
  }

  @InjectTransactionManager()
  private async deleteGuardedOptions(
    ids: string | string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const options = await this.listCategoryFieldOptions(
      { id: [ids].flat() },
      { relations: ['field'], take: null },
      sharedContext,
    );
    await this.refuseRemovals(options.map(optionRemoval), sharedContext);
    await CatalogModuleBase.prototype.deleteCategoryFieldOptions.call(
      this,
      ids,
      sharedContext,
    );
  }

  override createCategoryFields = ((
    data: NewCategoryField | NewCategoryField[],
    context?: Context,
  ) =>
    this.createGuardedFields(
      data,
      context,
    )) as unknown as CatalogModuleBase['createCategoryFields'];

  override updateCategoryFields = ((
    data: CategoryFieldUpdate | CategoryFieldUpdate[],
    context?: Context,
  ) =>
    this.updateGuardedFields(
      data,
      context,
    )) as unknown as CatalogModuleBase['updateCategoryFields'];

  override deleteCategoryFields = ((
    ids: string | string[],
    context?: Context,
  ) =>
    this.deleteGuardedFields(
      ids,
      context,
    )) as CatalogModuleBase['deleteCategoryFields'];

  override deleteCategoryFieldOptions = ((
    ids: string | string[],
    context?: Context,
  ) =>
    this.deleteGuardedOptions(
      ids,
      context,
    )) as CatalogModuleBase['deleteCategoryFieldOptions'];
}

export default CatalogModuleService;
