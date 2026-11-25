import type { MedusaContainer } from '@medusajs/framework/types';
import {
  MIN_REQUIREMENT_MATCHES_FOR_PAGE,
  makeHasPage,
  seriesCategoryHasPage,
  seriesHasPage,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';
import type {
  PlaceScope,
  SeriesCategoryCount,
} from '../modules/publish/service';

export type CatalogueModules = {
  catalog: CatalogModuleService;
  publish: PublishModuleService;
};

export const catalogueModules = (scope: MedusaContainer): CatalogueModules => ({
  catalog: scope.resolve(CATALOG_MODULE),
  publish: scope.resolve(PUBLISH_MODULE),
});

export type SeriesPartCount = {
  series_id: string;
  parts: number;
  required: number;
};

const seriesCountsOf = (rows: SeriesCategoryCount[]): SeriesPartCount[] => {
  const counts = new Map<string, SeriesPartCount>();
  for (const { series_id, parts, fitted, required } of rows) {
    const known = counts.get(series_id) ?? { series_id, parts: 0, required: 0 };
    counts.set(series_id, {
      series_id,
      parts:
        known.parts +
        (required >= MIN_REQUIREMENT_MATCHES_FOR_PAGE ? parts : fitted),
      required: Math.max(known.required, required),
    });
  }
  return [...counts.values()];
};

export const seriesPartCounts = async (
  publish: PublishModuleService,
  scope: Pick<PlaceScope, 'series'> = {},
): Promise<SeriesPartCount[]> =>
  seriesCountsOf(await publish.listedSeriesCategoryCounts(scope));

type SeriesRow = Awaited<
  ReturnType<CatalogModuleService['listSeries']>
>[number];

export type PagedSeries = SeriesRow & {
  slug: string;
  categoryIds: string[];
};

export type CatalogueStructure = {
  series: SeriesRow[];
  stocked: SeriesRow[];
  paged: PagedSeries[];
  hub: (makeSlug: string) => boolean;
};

export async function catalogueStructure(
  { catalog, publish }: CatalogueModules,
  filter: { make_id?: string; id?: string[] } = {},
): Promise<CatalogueStructure> {
  const series =
    filter.id && !filter.id.length
      ? []
      : await catalog.listSeries(filter, { relations: ['make'], take: null });
  const held = series.length
    ? await publish.listedSeriesCategoryCounts({
        series: series.map(({ id }) => id),
      })
    : [];
  const counts = new Map(
    seriesCountsOf(held).map((row) => [row.series_id, row]),
  );
  const paged = series
    .filter(({ id }) => {
      const count = counts.get(id);
      return count !== undefined && seriesHasPage(count);
    })
    .map((row) => ({
      ...row,
      slug: seriesSlugOf(row.name),
      categoryIds: held
        .filter(
          ({ series_id, category_id, parts }) =>
            series_id === row.id &&
            category_id !== null &&
            seriesCategoryHasPage(parts),
        )
        .map(({ category_id }) => category_id!),
    }));
  return {
    series,
    stocked: series.filter(({ id }) => counts.has(id)),
    paged,
    hub: (makeSlug) =>
      makeHasPage(paged.filter(({ make }) => make.slug === makeSlug).length),
  };
}
