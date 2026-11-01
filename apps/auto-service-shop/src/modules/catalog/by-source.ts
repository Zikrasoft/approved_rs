import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';
import type { Context } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../_shared/admin-error';
import { chunksOf, ID_CHUNK } from '../_shared/chunks';
import { MANUAL_SOURCE } from './models/provenance';
import type CatalogModuleService from './service';

type SourcedRows = {
  entity: string;
  list: (filters: { source: string }, context: Context) => Promise<Row[]>;
  remove: (ids: string[], context: Context) => Promise<void>;
};

type Row = { id: string };

export type SourceCount = { source: string; rows: number };

const CHUNK_COLUMNS = { select: ['id'], take: ID_CHUNK };

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

export async function deleteRowsBySource(
  source: string,
  tables: SourcedRows[],
  {
    count,
    flush,
    context,
  }: {
    count: () => Promise<SourceCount[]>;
    flush: () => Promise<void>;
    context: Context;
  },
): Promise<number> {
  if (source === MANUAL_SOURCE) {
    throw adminError(
      MedusaError.Types.NOT_ALLOWED,
      'MANUAL_SOURCE',
      'Rows typed in by hand are never deleted by source',
    );
  }
  const before = await count();
  let deleted = 0;
  for (const { entity, list, remove } of tables) {
    for (;;) {
      const ids = (await list({ source }, context)).map(({ id }) => id);
      if (!ids.length) break;
      await remove(ids, context).catch((error: unknown) => {
        throw MedusaError.isMedusaError(error) &&
          error.type === MedusaError.Types.NOT_FOUND
          ? sourceInUse(source, { blocked: entity })
          : error;
      });
      deleted += ids.length;
    }
  }
  await flush();
  const after = await count();
  const holders = before
    .filter((count) => count.source !== source)
    .map(({ source: holder, rows }) => ({
      source: holder,
      rows: rows - (after.find((count) => count.source === holder)?.rows ?? 0),
    }))
    .filter(({ rows }) => rows > 0);
  if (holders.length) {
    throw sourceInUse(source, { holders });
  }
  return deleted;
}
