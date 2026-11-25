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
import { memoized } from './catalogue-memo';

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

const listedSeriesCategoryCounts = (publish: PublishModuleService) =>
  memoized(publish, 'series-category-counts', () =>
    publish.listedSeriesCategoryCounts(),
  );

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
  const ids = new Set(series.map(({ id }) => id));
  const held = series.length
    ? (await listedSeriesCategoryCounts(publish)).filter(({ series_id }) =>
        ids.has(series_id),
      )
    : [];
  const counts = new Map(
    seriesCountsOf(held).map((row) => [row.series_id, row]),
  );
  const categoryPages = new Map<string, string[]>();
  for (const { series_id, category_id, parts } of held) {
    if (category_id !== null && seriesCategoryHasPage(parts)) {
      categoryPages.set(series_id, [
        ...(categoryPages.get(series_id) ?? []),
        category_id,
      ]);
    }
  }
  const paged = series
    .filter(({ id }) => {
      const count = counts.get(id);
      return count !== undefined && seriesHasPage(count);
    })
    .map((row) => ({
      ...row,
      slug: seriesSlugOf(row.name),
      categoryIds: categoryPages.get(row.id) ?? [],
    }));
  const pagedPerMake = new Map<string, number>();
  for (const { make } of paged) {
    pagedPerMake.set(make.slug, (pagedPerMake.get(make.slug) ?? 0) + 1);
  }
  return {
    series,
    stocked: series.filter(({ id }) => counts.has(id)),
    paged,
    hub: (makeSlug) => makeHasPage(pagedPerMake.get(makeSlug) ?? 0),
  };
}

export async function seriesPagedInCategory(
  modules: CatalogueModules,
  categoryId: string,
): Promise<(SeriesRow & { slug: string })[]> {
  const held = (await listedSeriesCategoryCounts(modules.publish)).filter(
    ({ category_id, parts }) =>
      category_id === categoryId && seriesCategoryHasPage(parts),
  );
  const sure = ({ fitted, required }: SeriesCategoryCount) =>
    seriesHasPage({ parts: fitted, required });
  const surely = held.filter(sure);
  const rest = held.filter((row) => !sure(row));
  return [
    ...(surely.length
      ? await modules.catalog.listSeries(
          { id: surely.map(({ series_id }) => series_id) },
          { relations: ['make'], take: null },
        )
      : []
    ).map((row) => ({ ...row, slug: seriesSlugOf(row.name) })),
    ...(rest.length
      ? (
          await catalogueStructure(modules, {
            id: rest.map(({ series_id }) => series_id),
          })
        ).paged
      : []),
  ];
}
