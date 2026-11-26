import type { MedusaContainer } from '@medusajs/framework/types';
import {
  generationOf,
  requirementMatchesCount,
  type CatalogLocale,
  type PartDemand,
  type SeriesCategoryPageResponse,
  type SeriesPageResponse,
  SERIES_CATEGORY_PAGE_SIZE,
  seriesCategoryPageCount,
  type SluggedPartPage,
  type Vehicle,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import type CatalogModuleService from '../modules/catalog/service';
import type { VehiclePart } from '../modules/publish/service';
import { CATEGORY_RELATIONS, shownCategory } from './categories';
import {
  localizedCategory,
  localizedSeries,
  localizedVehicle,
} from './catalogue-locale';
import { groupBy } from './group-by';
import { memoPartDemand } from './part-demand';
import { localizedFit, publishedOfParts, sluggedPagesOf } from './part-pages';
import { catalogueModules, catalogueStructure } from './catalogue-structure';
import { vehiclesOfSeries } from './series-vehicles';
import { toFitmentResponse } from './store-response';

export const SERIES_FITS_SHOWN = 6;

type Options = { locale: CatalogLocale; shown: boolean };

async function placeOf(
  scope: MedusaContainer,
  makeSlug: string,
  seriesSlug: string,
) {
  const modules = catalogueModules(scope);
  const { catalog, publish } = modules;
  const [make] = await catalog.listMakes({ slug: makeSlug });
  if (!make) return null;
  const named = (
    await catalog.listSeries({ make_id: make.id }, { take: null })
  ).find(({ name }) => seriesSlugOf(name) === seriesSlug);
  if (!named) return null;
  const [structure, vehicles, held] = await Promise.all([
    catalogueStructure(modules, { id: [named.id] }),
    vehiclesOfSeries(catalog, [named.id]),
    publish.listedCategoryParts([named.id]),
  ]);
  const [paged] = structure.paged;
  if (!paged) return null;
  const partsIn = groupBy(held, ({ category_id }) => category_id);
  return {
    ...modules,
    scope,
    seriesId: named.id,
    series: {
      ...vehicles[0].model.chassis.series,
      slug: paged.slug,
    },
    vehicles,
    categories: new Map(
      paged.categoryIds.map((id) => [
        id,
        [
          ...new Set((partsIn.get(id) ?? []).map(({ part_id }) => part_id)),
        ].sort(),
      ]),
    ),
  };
}

type Place = NonNullable<Awaited<ReturnType<typeof placeOf>>>;

const modelsWithParts = (
  vehicles: Vehicle[],
  { fitted, required }: { fitted: string[]; required: VehiclePart[] },
): Vehicle[][] => {
  const fittedIds = new Set(fitted);
  const requiredBy = groupBy(required, ({ vehicle_id }) => vehicle_id);
  return [...groupBy(vehicles, ({ model }) => model.slug).values()].filter(
    (group) => {
      const engineLess = group.filter(({ engine }) => engine === null);
      const fits = group.some((vehicle) =>
        [vehicle, ...generationOf(vehicle, engineLess)].some(({ id }) =>
          fittedIds.has(id),
        ),
      );
      const matched = groupBy(
        group.flatMap(({ id }) => requiredBy.get(id) ?? []),
        ({ category_id }) => category_id,
      );
      return (
        fits ||
        [...matched.values()].some((rows) =>
          requirementMatchesCount(
            new Set(rows.map(({ part_id }) => part_id)).size,
          ),
        )
      );
    },
  );
};

const pagesOfParts = async (
  scope: MedusaContainer,
  partIds: string[],
  options: Options & { demand?: Map<string, PartDemand> },
  only?: string[],
): Promise<SluggedPartPage[]> =>
  sluggedPagesOf(scope, await publishedOfParts(scope, partIds, only), options);

const shownCategories = async (catalog: CatalogModuleService, ids: string[]) =>
  ids.length
    ? (
        await catalog.listCategories(
          { id: ids },
          { relations: CATEGORY_RELATIONS, order: { slug: 'ASC' }, take: null },
        )
      ).map(shownCategory)
    : [];

const localizedPlace = (
  { series, vehicles }: Pick<Place, 'series' | 'vehicles'>,
  locale: CatalogLocale,
) => ({
  series: localizedSeries(series, locale),
  vehicles: vehicles.map((vehicle) => localizedVehicle(vehicle, locale)),
});

export async function seriesPageAt(
  scope: MedusaContainer,
  makeSlug: string,
  seriesSlug: string,
  options: Options,
): Promise<SeriesPageResponse | null> {
  const [place, demand] = await Promise.all([
    placeOf(scope, makeSlug, seriesSlug),
    memoPartDemand(scope),
  ]);
  if (!place) return null;
  const { locale } = options;
  const [categories, popular, parts] = await Promise.all([
    shownCategories(place.catalog, [...place.categories.keys()]),
    pagesOfParts(
      scope,
      [...new Set([...place.categories.values()].flat())],
      { ...options, demand },
      [...demand].flatMap(([id, { popular }]) => (popular ? [id] : [])),
    ),
    place.publish.seriesVehicleParts(place.seriesId),
  ]);
  return {
    series: localizedSeries(place.series, locale),
    models: modelsWithParts(place.vehicles, parts).map((vehicles) => ({
      vehicles: localizedPlace({ ...place, vehicles }, locale).vehicles,
    })),
    categories: categories.map((category) =>
      localizedCategory(category, locale),
    ),
    popular,
  };
}

export async function seriesCategoryPageAt(
  scope: MedusaContainer,
  makeSlug: string,
  seriesSlug: string,
  categorySlug: string,
  options: Options,
  page = 1,
): Promise<SeriesCategoryPageResponse | null> {
  const [place, [category]] = await Promise.all([
    placeOf(scope, makeSlug, seriesSlug),
    catalogueModules(scope).catalog.listCategories(
      { slug: categorySlug },
      { relations: CATEGORY_RELATIONS },
    ),
  ]);
  const listed = place && category && place.categories.get(category.id);
  if (!place || !category || !listed) return null;
  const pages = seriesCategoryPageCount(listed.length);
  if (page > pages) return null;
  const partIds = listed.slice(
    (page - 1) * SERIES_CATEGORY_PAGE_SIZE,
    page * SERIES_CATEGORY_PAGE_SIZE,
  );
  const [numbers, fitments] = await Promise.all([
    pagesOfParts(scope, partIds, options),
    place.catalog.fitmentRows({
      part_id: partIds,
      vehicle_id: place.vehicles.map(({ id }) => id),
    }),
  ]);
  const pagesOf = groupBy(numbers, ({ part }) => part.id);
  const fitsOf = groupBy(
    fitments.map(toFitmentResponse),
    ({ part_id }) => part_id,
  );
  const parts = partIds.flatMap((id) => {
    const own = pagesOf.get(id);
    const fits = fitsOf.get(id) ?? [];
    return own
      ? [
          {
            pages: own,
            fits: fits
              .slice(0, SERIES_FITS_SHOWN)
              .map((fit) => localizedFit(fit, options.locale)),
            fit_count: fits.length,
          },
        ]
      : [];
  });
  const fitted = new Set(
    parts.flatMap(({ fits }) => fits.map(({ vehicle_id }) => vehicle_id)),
  );
  return {
    ...localizedPlace(
      {
        series: place.series,
        vehicles: place.vehicles.filter(({ id }) => fitted.has(id)),
      },
      options.locale,
    ),
    category: localizedCategory(shownCategory(category), options.locale),
    parts,
    page,
    pages,
  };
}
