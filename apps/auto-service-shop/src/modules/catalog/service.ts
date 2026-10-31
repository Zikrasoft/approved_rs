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
  normalizePartNumber,
  partPageSlug,
  requirementErrors,
  RESERVED_PARTS_SEGMENTS,
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
import Requirement from './models/requirement';
import PartIdentifier, {
  type PART_IDENTIFIER_TYPES,
} from './models/part-identifier';
import Series from './models/series';
import SlugRedirect, { type SlugKind } from './models/slug-redirect';
import Vehicle from './models/vehicle';
import VehicleIdentifier from './models/vehicle-identifier';
import VehicleModel from './models/vehicle-model';
import { adminError, alreadyExists } from '../../lib/admin-errors';
import { modelSlugOf, slugOf, vehicleSlugOf } from '../../lib/slug';
import { spellingKey } from '../../lib/suppliers/spelling';
import { MANUAL_SOURCE, WORKSHOP_QUOTE_SOURCE } from './models/provenance';

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

export const matchesFilter =
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
  engine_id: string;
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

export type WorkshopQuoteLine = {
  name: string;
  number: string;
  quantity: number;
  brand: string;
  category_id: string | null;
};

export type WorkshopQuoteResult = {
  lines: { part_id: string; reused: boolean }[];
  fitments: number;
};

type QuoteBrand = {
  id: string;
  name: string;
  slug: string;
  spellings: { value_key: string }[];
};

type SourcedRow = { id: string; source: string };

type SourcedRows = {
  entity: string;
  list: (
    filters: { source?: string },
    context: Context,
  ) => Promise<SourcedRow[]>;
  remove: (ids: string[], context: Context) => Promise<void>;
};

export type SourceCount = { source: string; rows: number };

const SOURCE_COLUMNS = { select: ['id', 'source'], take: null };

const sourceInUse = (source: string, details: Record<string, unknown>) =>
  adminError(
    MedusaError.Types.NOT_ALLOWED,
    'SOURCE_IN_USE',
    `Rows of other sources still use rows of ${source}`,
    details,
  );

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
  SlugRedirect,
});

type CatalogModuleBase = InstanceType<typeof CatalogModuleBase>;

type SpellingInput = { value: string } & Record<string, unknown>;

const withValueKey = (row: SpellingInput) => ({
  ...row,
  value_key: spellingKey(row.value),
});

export type SluggedKind = Exclude<SlugKind, 'part'>;

type SlugInput = Record<string, unknown> & { slug?: string };

type SluggedRow = { id: string; slug: string };

type Retirement = {
  id: string;
  slug: string;
  scope_id: string | null;
  target_kind: SlugKind | null;
  target_id: string | null;
};

const SLUG_COLUMNS = { select: ['id', 'slug'], take: null };

const RETIRING_DELETES = {
  part_identifier: 'deletePartIdentifiers',
  part: 'deleteParts',
  vehicle: 'deleteVehicles',
  model: 'deleteVehicleModels',
  make: 'deleteMakes',
  brand: 'deleteBrands',
  category: 'deleteCategories',
} as const;

type RetiringTable = keyof typeof RETIRING_DELETES;

const scopedKind = (kind: SluggedKind) =>
  kind === 'vehicle' || kind === 'model';

const slugScopeOf = (kind: SluggedKind, row: SlugInput): string | null =>
  kind === 'vehicle'
    ? String(row.model_id)
    : kind === 'model'
      ? String(row.make_id)
      : null;

// TODO: a move that lands a Model in a Make already holding its slug fails on the unique index; re-slug it as mergeModels does for Vehicles if staff hit it.
const MODELS_FOLLOW_THEIR_MAKE = `update vehicle_model m set make_id = s.make_id
  from chassis c join series s on s.id = c.series_id
  where c.id = m.chassis_id and m.make_id <> s.make_id`;

const slugInUse = () =>
  adminError(
    MedusaError.Types.CONFLICT,
    'SLUG_TAKEN',
    'This slug is taken or was used before',
  );

const reservedSection = (kind: SluggedKind, slug: string) =>
  kind === 'make' &&
  RESERVED_PARTS_SEGMENTS.some((segment) => segment === slug);

const refuseReservedSection = (kind: SluggedKind, slug: string) => {
  if (reservedSection(kind, slug)) {
    throw adminError(
      MedusaError.Types.INVALID_DATA,
      'SLUG_RESERVED',
      'This slug is a storefront section',
    );
  }
};

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
      const engine = await this.retrieveEngine(
        String(row.engine_id),
        { select: ['code'] },
        context,
      );
      return vehicleSlugOf({
        engine: engine.code,
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
    await (sharedContext.transactionManager as SqlEntityManager).execute(
      MODELS_FOLLOW_THEIR_MAKE,
    );
    return updated;
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

  @InjectTransactionManager()
  async mergeMakes(
    sourceId: string,
    targetId: string,
    provenance: Provenance,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    if (sourceId === targetId) {
      throw adminError(
        MedusaError.Types.INVALID_DATA,
        'MERGE_INTO_SELF',
        'A Make cannot be merged into itself',
      );
    }
    const source = await this.retrieveMake(
      sourceId,
      { select: ['id', 'slug'] },
      sharedContext,
    );
    await this.retrieveMake(targetId, { select: ['id'] }, sharedContext);
    const spellingsOf = (make_id: string) =>
      this.listMakeSpellings(
        { make_id },
        { select: ['id', 'supplier_id', 'value_key'], take: null },
        sharedContext,
      );
    const seriesOf = (make_id: string) =>
      this.listSeries(
        { make_id },
        { select: ['id', 'name'], take: null },
        sharedContext,
      );
    const spelled = new Set(
      (await spellingsOf(targetId)).map(({ supplier_id, value_key }) =>
        JSON.stringify([supplier_id, value_key]),
      ),
    );
    for (const { id, supplier_id, value_key } of await spellingsOf(sourceId)) {
      if (spelled.has(JSON.stringify([supplier_id, value_key]))) {
        await this.deleteMakeSpellings(id, sharedContext);
      } else {
        await this.updateMakeSpellings(
          { id, make_id: targetId },
          sharedContext,
        );
      }
    }
    const targetSeries = await seriesOf(targetId);
    for (const series of await seriesOf(sourceId)) {
      const same = targetSeries.find(
        ({ name }) => spellingKey(name) === spellingKey(series.name),
      );
      if (same) {
        await this.mergeSeries(
          series.id,
          same.id,
          targetId,
          provenance,
          sharedContext,
        );
      } else {
        await this.updateSeries(
          { id: series.id, make_id: targetId },
          sharedContext,
        );
      }
    }
    await this.updateSlugRedirects(
      {
        selector: { kind: 'model', scope_id: sourceId },
        data: { scope_id: targetId },
      },
      sharedContext,
    );
    await this.retireSlugs(
      'make',
      [
        {
          id: sourceId,
          slug: source.slug,
          scope_id: null,
          target_kind: 'make',
          target_id: targetId,
        },
      ],
      sharedContext,
      provenance,
    );
    await this.flush(sharedContext);
    await CatalogModuleBase.prototype.deleteMakes.call(
      this,
      sourceId,
      sharedContext,
    );
  }

  private async mergeSeries(
    sourceId: string,
    targetId: string,
    makeId: string,
    provenance: Provenance,
    context: Context,
  ): Promise<void> {
    const targets = await this.listChassis(
      { series_id: targetId },
      { take: null },
      context,
    );
    for (const chassis of await this.listChassis(
      { series_id: sourceId },
      { take: null },
      context,
    )) {
      const same = targets.find(({ code }) => code === chassis.code);
      if (same) {
        await this.mergeChassis(
          chassis.id,
          same.id,
          makeId,
          provenance,
          context,
        );
      } else {
        await this.updateChassis(
          { id: chassis.id, series_id: targetId },
          context,
        );
      }
    }
    await this.flush(context);
    await this.deleteSeries(sourceId, context);
  }

  private async mergeChassis(
    sourceId: string,
    targetId: string,
    makeId: string,
    provenance: Provenance,
    context: Context,
  ): Promise<void> {
    const targets = await this.listVehicleModels(
      { chassis_id: targetId },
      { take: null },
      context,
    );
    for (const model of await this.listVehicleModels(
      { chassis_id: sourceId },
      { take: null },
      context,
    )) {
      const same = targets.find(
        ({ name }) => spellingKey(name) === spellingKey(model.name),
      );
      if (same) {
        await this.mergeModels(model, same.id, makeId, provenance, context);
      } else {
        await this.updateVehicleModels(
          { id: model.id, chassis_id: targetId },
          context,
        );
      }
    }
    const required = new Set(
      (
        await this.listRequirements(
          { chassis_id: targetId },
          { select: ['field_id'], take: null },
          context,
        )
      ).map(({ field_id }) => field_id),
    );
    const movable = (
      await this.listRequirements(
        { chassis_id: sourceId },
        { select: ['id', 'field_id'], take: null },
        context,
      )
    ).filter(({ field_id }) => !required.has(field_id));
    if (movable.length) {
      await this.updateRequirements(
        {
          selector: { id: movable.map(({ id }) => id) },
          data: { chassis_id: targetId },
        },
        context,
      );
    }
    await this.flush(context);
    await this.deleteChassis(sourceId, context);
  }

  private async mergeModels(
    source: { id: string; slug: string },
    targetId: string,
    makeId: string,
    provenance: Provenance,
    context: Context,
  ): Promise<void> {
    const renamed: { id: string; slug: string }[] = [];
    for (const vehicle of await this.listVehicles(
      { model_id: source.id },
      { select: ['id', 'slug', 'engine_id', 'power_kw'], take: null },
      context,
    )) {
      const slug = (await this.slugTaken(
        'vehicle',
        vehicle.slug,
        targetId,
        context,
      ))
        ? await this.slugFor(
            'vehicle',
            { ...vehicle, slug: undefined, model_id: targetId },
            new Set(),
            context,
          )
        : vehicle.slug;
      if (slug !== vehicle.slug) renamed.push(vehicle);
      await this.updateVehicles(
        { id: vehicle.id, model_id: targetId, slug },
        context,
      );
    }
    await this.updateSlugRedirects(
      {
        selector: { kind: 'vehicle', scope_id: source.id },
        data: { scope_id: targetId },
      },
      context,
    );
    if (renamed.length) {
      await this.createSlugRedirects(
        renamed.map(({ id, slug }) => ({
          kind: 'vehicle' as const,
          from_id: id,
          from_slug: slug,
          scope_id: source.id,
          target_kind: 'vehicle' as const,
          target_id: id,
          ...provenance,
        })),
        context,
      );
    }
    await this.retireSlugs(
      'model',
      [
        {
          id: source.id,
          slug: source.slug,
          scope_id: makeId,
          target_kind: 'model',
          target_id: targetId,
        },
      ],
      context,
      provenance,
    );
    await this.flush(context);
    await CatalogModuleBase.prototype.deleteVehicleModels.call(
      this,
      source.id,
      context,
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
      return identifiers.map(({ id, brand, normalized_value, part }) => ({
        id,
        slug: partPageSlug(brand.slug, normalized_value),
        scope_id: null,
        target_kind: part.category_id ? 'category' : null,
        target_id: part.category_id ?? null,
      }));
    }
    if (table === 'vehicle') {
      const vehicles = await this.listVehicles(
        { id: ids },
        { select: ['id', 'slug', 'model_id'], take: null },
        context,
      );
      return vehicles.map(({ id, slug, model_id }) => ({
        id,
        slug,
        scope_id: model_id,
        target_kind: 'model',
        target_id: model_id,
      }));
    }
    if (table === 'model') {
      const models = await this.listVehicleModels(
        { id: ids },
        { select: ['id', 'slug', 'make_id'], take: null },
        context,
      );
      return models.map(({ id, slug, make_id }) => ({
        id,
        slug,
        scope_id: make_id,
        target_kind: 'make',
        target_id: make_id,
      }));
    }
    const rows = await this.sluggedRows(table).list({ id: ids }, context);
    return rows.map(({ id, slug }) => ({
      id,
      slug,
      scope_id: null,
      target_kind: null,
      target_id: null,
    }));
  }

  @InjectTransactionManager()
  private async deleteRetiring(
    table: RetiringTable,
    ids: string | string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const list = [ids].flat();
    await this.retireSlugs(
      table === 'part_identifier' ? 'part' : table,
      await this.retirementsOf(table, list, sharedContext),
      sharedContext,
    );
    await CatalogModuleBase.prototype[RETIRING_DELETES[table]].call(
      this,
      list,
      sharedContext,
    );
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
    const created = await this.createParts(
      {
        name,
        description,
        source_name,
        source_url,
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
  async findOrCreatePart(
    { identifier, ...part }: NewNumberedPart,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<FoundPart> {
    await this.lockNumbers([identifier], sharedContext);
    const normalized = normalizePartNumber(identifier.value);
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

  @InjectTransactionManager()
  async createFromWorkshopQuote(
    lines: WorkshopQuoteLine[],
    vehicleId: string | null,
    provenance: Provenance,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<WorkshopQuoteResult> {
    const brands = await this.listBrands(
      {},
      { relations: ['spellings'], take: null },
      sharedContext,
    );
    const result: WorkshopQuoteResult = { lines: [], fitments: 0 };
    for (const line of lines) {
      const brandId = await this.quoteBrand(
        line.brand,
        brands,
        provenance,
        sharedContext,
      );
      const { part_id: partId, created: newPart } = await this.findOrCreatePart(
        {
          name: line.name,
          identifier: {
            type: 'manufacturer-number',
            brand_id: brandId,
            value: line.number,
          },
          category_id: await this.quoteCategory(
            line.category_id,
            sharedContext,
          ),
          ...provenance,
          source: WORKSHOP_QUOTE_SOURCE,
        },
        sharedContext,
      );
      if (vehicleId) {
        const { created } = await this.attachPartToVehicles(
          partId,
          { vehicle_id: vehicleId },
          { quantity: line.quantity, ...provenance },
          sharedContext,
        );
        result.fitments += created.length;
      }
      result.lines.push({ part_id: partId, reused: !newPart });
    }
    return result;
  }

  private async quoteBrand(
    name: string,
    brands: QuoteBrand[],
    provenance: Provenance,
    sharedContext: Context,
  ): Promise<string> {
    const key = spellingKey(name);
    const slug = slugOf(name);
    const known = brands.find(
      (brand) =>
        spellingKey(brand.name) === key ||
        brand.slug === slug ||
        brand.spellings.some(({ value_key }) => value_key === key),
    );
    if (known) return known.id;
    if (!slug) {
      throw adminError(
        MedusaError.Types.INVALID_DATA,
        'INVALID_BRAND',
        `Brand ${name} has no Latin letters for its slug`,
      );
    }
    const created = await this.createBrands(
      { name: name.trim(), ...provenance },
      sharedContext,
    );
    brands.push({ ...created, spellings: [] });
    return created.id;
  }

  private async quoteCategory(
    categoryId: string | null,
    sharedContext: Context,
  ): Promise<string | null> {
    if (!categoryId) return null;
    const fields = await this.categoryDefinition(categoryId, sharedContext);
    return fields.some(({ required }) => required) ? null : categoryId;
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
    table: 'part' | 'vehicle_model',
    id: string,
    sharedContext: Context,
  ): Promise<void> {
    await (sharedContext.transactionManager as SqlEntityManager).execute(
      `select id from "${table}" where id = ? for update`,
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
          ({ brand_id, value }) => `${brand_id}:${normalizePartNumber(value)}`,
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
          normalized_value: normalizePartNumber(value),
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
    const values = await this.validatePartAttributes(
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
        entity: 'requirement',
        list: (filters, context) =>
          this.listRequirements(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteRequirements(ids, context),
      },
      {
        entity: 'fitment',
        list: (filters, context) =>
          this.listFitments(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteFitments(ids, context),
      },
      {
        entity: 'vehicle_identifier',
        list: (filters, context) =>
          this.listVehicleIdentifiers(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteVehicleIdentifiers(ids, context),
      },
      {
        entity: 'brand_spelling',
        list: (filters, context) =>
          this.listBrandSpellings(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteBrandSpellings(ids, context),
      },
      {
        entity: 'make_spelling',
        list: (filters, context) =>
          this.listMakeSpellings(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteMakeSpellings(ids, context),
      },
      {
        entity: 'part_identifier',
        list: (filters, context) =>
          this.listPartIdentifiers(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deletePartIdentifiers(ids, context),
      },
      {
        entity: 'part',
        list: (filters, context) =>
          this.listParts(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteParts(ids, context),
      },
      {
        entity: 'vehicle',
        list: (filters, context) =>
          this.listVehicles(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteVehicles(ids, context),
      },
      {
        entity: 'category_field_option',
        list: (filters, context) =>
          this.listCategoryFieldOptions(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteCategoryFieldOptions(ids, context),
      },
      {
        entity: 'category_field',
        list: (filters, context) =>
          this.listCategoryFields(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteCategoryFields(ids, context),
      },
      {
        entity: 'category',
        list: (filters, context) =>
          this.listCategories(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteCategories(ids, context),
      },
      {
        entity: 'vehicle_model',
        list: (filters, context) =>
          this.listVehicleModels(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteVehicleModels(ids, context),
      },
      {
        entity: 'engine',
        list: (filters, context) =>
          this.listEngines(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteEngines(ids, context),
      },
      {
        entity: 'chassis',
        list: (filters, context) =>
          this.listChassis(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteChassis(ids, context),
      },
      {
        entity: 'series',
        list: (filters, context) =>
          this.listSeries(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteSeries(ids, context),
      },
      {
        entity: 'make',
        list: (filters, context) =>
          this.listMakes(filters, SOURCE_COLUMNS, context),
        remove: (ids, context) => this.deleteMakes(ids, context),
      },
      {
        entity: 'brand',
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
    if (source === MANUAL_SOURCE) {
      throw adminError(
        MedusaError.Types.NOT_ALLOWED,
        'MANUAL_SOURCE',
        'Rows typed in by hand are never deleted by source',
      );
    }
    const before = await this.countRowsBySource(sharedContext);
    let deleted = 0;
    for (const { entity, list, remove } of this.sourcedRows()) {
      const ids = (await list({ source }, sharedContext)).map(({ id }) => id);
      if (ids.length) {
        await remove(ids, sharedContext).catch((error: unknown) => {
          throw MedusaError.isMedusaError(error) &&
            error.type === MedusaError.Types.NOT_FOUND
            ? sourceInUse(source, { blocked: entity })
            : error;
        });
        deleted += ids.length;
      }
    }
    const after = await this.countRowsBySource(sharedContext);
    const holders = before
      .filter((count) => count.source !== source)
      .map(({ source: holder, rows }) => ({
        source: holder,
        rows:
          rows - (after.find((count) => count.source === holder)?.rows ?? 0),
      }))
      .filter(({ rows }) => rows > 0);
    if (holders.length) {
      throw sourceInUse(source, { holders });
    }
    return deleted;
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
