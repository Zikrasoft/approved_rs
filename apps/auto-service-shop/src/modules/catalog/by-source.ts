import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';
import type { Context } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../_shared/admin-error';
import { runBoundSql } from '../_shared/bound-sql';
import { ID_CHUNK } from '../_shared/chunks';
import { MANUAL_SOURCE } from './models/provenance';
import type CatalogModuleService from './service';

export type SourcedRows = {
  entity: string;
  list: (
    filters: { source: string; id: { $gt: string } },
    context: Context,
  ) => Promise<Row[]>;
  remove: (ids: string[], context: Context) => Promise<void>;
};

type Row = { id: string };

export type SourceCount = { source: string; rows: number };

const CHUNK_COLUMNS = {
  select: ['id'],
  take: ID_CHUNK,
  order: { id: 'ASC' as const },
};

const sourceInUse = (source: string, details: Record<string, unknown>) =>
  adminError(
    MedusaError.Types.NOT_ALLOWED,
    'SOURCE_IN_USE',
    `Rows of other sources still use rows of ${source}`,
    details,
  );

export const sourcedRowsOf = (catalog: CatalogModuleService): SourcedRows[] => [
  {
    entity: 'requirement',
    list: (filters, context) =>
      catalog.listRequirements(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteRequirements(ids, context),
  },
  {
    entity: 'fitment',
    list: (filters, context) =>
      catalog.listFitments(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteFitments(ids, context),
  },
  {
    entity: 'vehicle_identifier',
    list: (filters, context) =>
      catalog.listVehicleIdentifiers(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteVehicleIdentifiers(ids, context),
  },
  {
    entity: 'brand_spelling',
    list: (filters, context) =>
      catalog.listBrandSpellings(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteBrandSpellings(ids, context),
  },
  {
    entity: 'make_spelling',
    list: (filters, context) =>
      catalog.listMakeSpellings(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteMakeSpellings(ids, context),
  },
  {
    entity: 'part_identifier',
    list: (filters, context) =>
      catalog.listPartIdentifiers(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deletePartIdentifiers(ids, context),
  },
  {
    entity: 'part',
    list: (filters, context) =>
      catalog.listParts(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteParts(ids, context),
  },
  {
    entity: 'vehicle',
    list: (filters, context) =>
      catalog.listVehicles(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteVehicles(ids, context),
  },
  {
    entity: 'category_field_option',
    list: (filters, context) =>
      catalog.listCategoryFieldOptions(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteCategoryFieldOptions(ids, context),
  },
  {
    entity: 'category_field',
    list: (filters, context) =>
      catalog.listCategoryFields(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteCategoryFields(ids, context),
  },
  {
    entity: 'category',
    list: (filters, context) =>
      catalog.listCategories(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteCategories(ids, context),
  },
  {
    entity: 'vehicle_model',
    list: (filters, context) =>
      catalog.listVehicleModels(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteVehicleModels(ids, context),
  },
  {
    entity: 'engine',
    list: (filters, context) =>
      catalog.listEngines(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteEngines(ids, context),
  },
  {
    entity: 'chassis',
    list: (filters, context) =>
      catalog.listChassis(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteChassis(ids, context),
  },
  {
    entity: 'series',
    list: (filters, context) =>
      catalog.listSeries(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteSeries(ids, context),
  },
  {
    entity: 'make',
    list: (filters, context) =>
      catalog.listMakes(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteMakes(ids, context),
  },
  {
    entity: 'brand',
    list: (filters, context) =>
      catalog.listBrands(filters, CHUNK_COLUMNS, context),
    remove: (ids, context) => catalog.deleteBrands(ids, context),
  },
];

export async function countRowsBySource(
  manager: SqlEntityManager,
  tables: SourcedRows[],
): Promise<SourceCount[]> {
  const perTable = tables.map(
    ({ entity }) =>
      `select source, count(*) as rows from "${entity}" where deleted_at is null group by source`,
  );
  const counts: { source: string; rows: string }[] = await manager.execute(
    `select source, sum(rows) as rows from (${perTable.join(' union all ')}) counted group by source`,
  );
  return counts
    .map(({ source, rows }) => ({ source, rows: Number(rows) }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

const SOURCE_REFUSALS = ['DEFINITION_BREAKS_PARTS', 'REQUIREMENT_IN_USE'];

export const refusingSourceUse =
  (source: string, entity: string) =>
  (error: unknown): never => {
    throw MedusaError.isMedusaError(error) &&
      (error.type === MedusaError.Types.NOT_FOUND ||
        SOURCE_REFUSALS.includes(String(error.code)))
      ? sourceInUse(source, { blocked: entity })
      : error;
  };

export const refuseManualSource = (source: string): void => {
  if (source === MANUAL_SOURCE) {
    throw adminError(
      MedusaError.Types.NOT_ALLOWED,
      'MANUAL_SOURCE',
      'Rows typed in by hand are never deleted by source',
    );
  }
};

const FOREIGN_KEYS = `
  select c.conrelid::regclass::text as holder, a.attname as column
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f' and c.confrelid = ?::regclass`;

export async function refuseForeignHolders(
  context: Context,
  tables: SourcedRows[],
  entity: string,
  source: string,
  ids?: string[],
): Promise<void> {
  const sourced = new Set(tables.map((table) => table.entity));
  const { rows: keys }: { rows: { holder: string; column: string }[] } =
    await runBoundSql(context, FOREIGN_KEYS, [entity]);
  for (const { holder, column } of keys.filter((key) =>
    sourced.has(key.holder),
  )) {
    const { rows } = await runBoundSql(
      context,
      `select 1 from "${holder}" h join "${entity}" t on t.id = h."${column}"
       where h.source <> ? and h.deleted_at is null and t.deleted_at is null
       and ${ids ? 't.id = any(?::text[])' : 't.source = ?'} limit 1`,
      [source, ids ?? source],
    );
    if (rows.length) {
      throw sourceInUse(source, { blocked: entity });
    }
  }
}

export const lockSourcedRows = (
  context: Context,
  entity: string,
  ids: string[],
) =>
  runBoundSql(
    context,
    `select id from "${entity}" where id = any(?::text[]) for update`,
    [ids],
  );
