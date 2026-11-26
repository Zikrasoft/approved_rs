import type { MedusaContainer } from '@medusajs/framework/types';
import {
  generationOf,
  requirementMatchesCount,
  type CatalogLocale,
  type PartDemand,
  type SeriesCategoryPageResponse,
  type SeriesPageResponse,
  type SluggedPartPage,
  type Vehicle,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import type CatalogModuleService from '../modules/catalog/service';
import type { VehiclePart } from '../modules/publish/service';
import { memoized } from './catalogue-memo';
import { CATEGORY_RELATIONS, shownCategory } from './categories';
import {
  localizedCategory,
  localizedSeries,
  localizedVehicle,
} from './catalogue-locale';
import { memoPartDemand } from './part-demand';
import { localizedFit, publishedOfParts, sluggedPagesOf } from './part-pages';
import { catalogueModules, catalogueStructure } from './catalogue-structure';
import { vehiclesOfSeries } from './series-vehicles';
import { toFitmentResponse } from './store-response';

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
  const [paged] = (await catalogueStructure(modules, { id: [named.id] })).paged;
  if (!paged) return null;
  const vehicles = await vehiclesOfSeries(catalog, [named.id]);
  const places = await memoized(`vehicle-parts:${named.id}`, () =>
    publish.listedVehicleParts(named.id),
  );
  return {
    ...modules,
    scope,
    series: {
      ...vehicles[0].model.chassis.series,
      slug: paged.slug,
    },
    vehicles,
    places,
    categories: new Map(
      paged.categoryIds.map((id) => [
        id,
        [
          ...new Set(
            places
              .filter(({ category_id }) => category_id === id)
              .map(({ part_id }) => part_id),
          ),
        ].sort(),
      ]),
    ),
  };
}

type Place = NonNullable<Awaited<ReturnType<typeof placeOf>>>;

const groupBy = <Row, Key>(rows: Row[], key: (row: Row) => Key) => {
  const groups = new Map<Key, Row[]>();
  for (const row of rows) {
    groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  }
  return groups;
};

const modelsWithParts = ({ vehicles, places }: Place): Vehicle[][] => {
  const fittedBy = groupBy(
    places.filter(({ fitted }) => fitted),
    ({ vehicle_id }) => vehicle_id,
  );
  const required: VehiclePart[] = places.filter(({ fitted }) => !fitted);
  return [...groupBy(vehicles, ({ model }) => model.slug).values()].filter(
    (group) => {
      const engineLess = group.filter(({ engine }) => engine === null);
      const ids = new Set(group.map(({ id }) => id));
      const parts = new Set(
        group.flatMap((vehicle) =>
          [vehicle, ...generationOf(vehicle, engineLess)].flatMap(({ id }) =>
            (fittedBy.get(id) ?? []).map(({ part_id }) => part_id),
          ),
        ),
      );
      const matched = groupBy(
        required.filter(({ vehicle_id }) => ids.has(vehicle_id)),
        ({ category_id }) => category_id,
      );
      for (const rows of matched.values()) {
        const partIds = new Set(rows.map(({ part_id }) => part_id));
        if (requirementMatchesCount(partIds.size)) {
          partIds.forEach((id) => parts.add(id));
        }
      }
      return parts.size > 0;
    },
  );
};

const pagesOfParts = async (
  scope: MedusaContainer,
  partIds: string[],
  options: Options & { demand?: Map<string, PartDemand> },
  only?: (identifierId: string) => boolean,
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
  const place = await placeOf(scope, makeSlug, seriesSlug);
  if (!place) return null;
  const demand = await memoPartDemand(scope);
  const { locale } = options;
  return {
    series: localizedSeries(place.series, locale),
    models: modelsWithParts(place).map((vehicles) => ({
      vehicles: localizedPlace({ ...place, vehicles }, locale).vehicles,
    })),
    categories: (
      await shownCategories(place.catalog, [...place.categories.keys()])
    ).map((category) => localizedCategory(category, locale)),
    popular: await pagesOfParts(
      scope,
      [...new Set([...place.categories.values()].flat())],
      { ...options, demand },
      (id) => demand.get(id)?.popular === true,
    ),
  };
}

export async function seriesCategoryPageAt(
  scope: MedusaContainer,
  makeSlug: string,
  seriesSlug: string,
  categorySlug: string,
  options: Options,
): Promise<SeriesCategoryPageResponse | null> {
  const place = await placeOf(scope, makeSlug, seriesSlug);
  if (!place) return null;
  const [category] = await place.catalog.listCategories(
    { slug: categorySlug },
    { relations: CATEGORY_RELATIONS },
  );
  const partIds = category && place.categories.get(category.id);
  if (!category || !partIds) return null;
  const pages = await pagesOfParts(scope, partIds, options);
  const vehicleById = new Map(place.vehicles.map((one) => [one.id, one]));
  const fitments = (
    await place.catalog.listFitments(
      { part_id: partIds, vehicle_id: [...vehicleById.keys()] },
      { order: { id: 'ASC' }, take: null },
    )
  ).map(toFitmentResponse);
  const parts = partIds.flatMap((id) => {
    const own = pages.filter(({ part }) => part.id === id);
    return own.length
      ? [
          {
            pages: own,
            fits: fitments
              .filter(({ part_id }) => part_id === id)
              .map((fit) => localizedFit(fit, options.locale)),
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
  };
}
