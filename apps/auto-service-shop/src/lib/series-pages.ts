import type { MedusaContainer } from '@medusajs/framework/types';
import { seriesHasPage } from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';
import {
  type ListedPartCount,
  type SeriesCategoryCount,
  seriesCountsOf,
} from '../modules/publish/service';

export type CatalogueModules = {
  catalog: CatalogModuleService;
  publish: PublishModuleService;
};

export const catalogueModules = (scope: MedusaContainer): CatalogueModules => ({
  catalog: scope.resolve(CATALOG_MODULE),
  publish: scope.resolve(PUBLISH_MODULE),
});

const NO_PARTS = { parts: 0, required: 0 };

export async function seriesWithPages(
  { catalog, publish }: CatalogueModules,
  filters: Parameters<CatalogModuleService['listSeries']>[0],
) {
  const series = await catalog.listSeries(filters, {
    relations: ['make'],
    take: null,
  });
  const held: SeriesCategoryCount[] = series.length
    ? await publish.listedSeriesCategoryCounts({
        series: series.map(({ id }) => id),
      })
    : [];
  const counts = new Map<string, ListedPartCount>(
    seriesCountsOf(held).map((row) => [row.series_id, row]),
  );
  return {
    series,
    held,
    counts,
    paged: series.filter(({ id }) => seriesHasPage(counts.get(id) ?? NO_PARTS)),
  };
}

export const pagedSeries = async (
  modules: CatalogueModules,
  seriesIds: string[],
) =>
  seriesIds.length
    ? (await seriesWithPages(modules, { id: seriesIds })).paged
    : [];

export const partsByCategory = (
  places: { category_id: string | null; part_id: string }[],
) => {
  const byCategory = new Map<string, Set<string>>();
  for (const { category_id, part_id } of places) {
    if (category_id) {
      byCategory.set(
        category_id,
        (byCategory.get(category_id) ?? new Set()).add(part_id),
      );
    }
  }
  return byCategory;
};
