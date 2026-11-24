import type { MedusaContainer } from '@medusajs/framework/types';
import {
  generationOf,
  partPageSchema,
  partPageSlug,
  requirementMatchesCount,
  seriesCategoryHasPage,
  type CatalogLocale,
  type SeriesCategoryPageResponse,
  type SeriesPageResponse,
  type SluggedPartPage,
  type Vehicle,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import type CatalogModuleService from '../modules/catalog/service';
import type { PublishedNumber, VehiclePart } from '../modules/publish/service';
import { CATEGORY_RELATIONS, shownCategory } from './categories';
import { loadPartDemand } from './part-demand';
import { localized, localizedFit } from './part-page';
import { partPagesOf } from './part-pages';
import {
  type CatalogueModules,
  catalogueModules,
  partsByCategory,
  seriesWithPages,
} from './series-pages';
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
  const { paged } = await seriesWithPages(modules, { id: named.id });
  if (!paged.length) return null;
  const vehicles = await vehiclesOfSeries(catalog, [named.id]);
  const places = await publish.listedVehicleParts(named.id);
  return {
    ...modules,
    scope,
    series: {
      ...vehicles[0].model.chassis.series,
      slug: seriesSlugOf(named.name),
    },
    vehicles,
    places,
    categories: new Map(
      [...partsByCategory(places)]
        .filter(([, parts]) => seriesCategoryHasPage(parts.size))
        .map(([id, parts]) => [id, [...parts].sort()]),
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

export const publishedOfParts = async (
  { catalog, publish }: CatalogueModules,
  partIds: string[],
  only?: (identifierId: string) => boolean,
): Promise<(PublishedNumber & { part_id: string })[]> => {
  const identifiers = partIds.length
    ? await catalog.listPartIdentifiers(
        { part_id: partIds },
        { select: ['id', 'part_id'], order: { id: 'ASC' }, take: null },
      )
    : [];
  const partOf = new Map(identifiers.map(({ id, part_id }) => [id, part_id]));
  const published = await publish.publishedNumbers(
    identifiers.map(({ id }) => id).filter((id) => only?.(id) ?? true),
  );
  return published.map((row) => ({ ...row, part_id: partOf.get(row.id)! }));
};

export const pagesOfPublished = async (
  scope: MedusaContainer,
  published: PublishedNumber[],
  { locale, shown }: Options,
): Promise<SluggedPartPage[]> => {
  const pages = await partPagesOf(scope, published, {
    shown,
    demand: await loadPartDemand(scope),
  });
  const seen = new Set<string>();
  return pages
    .map((page) => ({
      ...localized(partPageSchema.parse(page), locale),
      slug: partPageSlug(page.brand.slug, page.normalized_value),
    }))
    .filter(({ slug }) => !seen.has(slug) && seen.add(slug));
};

export const pagesOfParts = async (
  modules: CatalogueModules,
  scope: MedusaContainer,
  partIds: string[],
  options: Options,
  only?: (identifierId: string) => boolean,
): Promise<SluggedPartPage[]> =>
  pagesOfPublished(
    scope,
    await publishedOfParts(modules, partIds, only),
    options,
  );

const shownCategories = async (catalog: CatalogModuleService, ids: string[]) =>
  ids.length
    ? (
        await catalog.listCategories(
          { id: ids },
          { relations: CATEGORY_RELATIONS, order: { slug: 'ASC' }, take: null },
        )
      ).map(shownCategory)
    : [];

export async function seriesPageAt(
  scope: MedusaContainer,
  makeSlug: string,
  seriesSlug: string,
  options: Options,
): Promise<SeriesPageResponse | null> {
  const place = await placeOf(scope, makeSlug, seriesSlug);
  if (!place) return null;
  const demand = await loadPartDemand(scope);
  return {
    series: place.series,
    models: modelsWithParts(place).map((vehicles) => ({ vehicles })),
    categories: await shownCategories(place.catalog, [
      ...place.categories.keys(),
    ]),
    popular: await pagesOfParts(
      place,
      scope,
      [...new Set([...place.categories.values()].flat())],
      options,
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
  const pages = await pagesOfParts(place, scope, partIds, options);
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
    series: place.series,
    category: shownCategory(category),
    parts,
    vehicles: place.vehicles.filter(({ id }) => fitted.has(id)),
  };
}
