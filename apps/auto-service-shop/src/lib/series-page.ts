import type { MedusaContainer } from '@medusajs/framework/types';
import {
  generationOf,
  partPageSchema,
  partPageSlug,
  requirementMatchesCount,
  seriesCategoryHasPage,
  seriesHasPage,
  type CatalogLocale,
  type SeriesCategoryPageResponse,
  type SeriesPageResponse,
  type SeriesPartPage,
  type Vehicle,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';
import { CATEGORY_RELATIONS, shownCategory } from './categories';
import { loadPartDemand } from './part-demand';
import { localized } from './part-page';
import { partPagesOf } from './part-pages';
import { vehicleRequirementFits } from './requirement-fit';
import { vehiclesOfSeries } from './series-vehicles';
import { toFitmentResponse } from './store-response';

type Options = { locale: CatalogLocale; shown: boolean };

const distinct = <T>(values: T[]) => [...new Set(values)];

async function placeOf(
  scope: MedusaContainer,
  makeSlug: string,
  seriesSlug: string,
) {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const [make] = await catalog.listMakes({ slug: makeSlug });
  if (!make) return null;
  const named = (
    await catalog.listSeries({ make_id: make.id }, { take: null })
  ).find(({ name }) => seriesSlugOf(name) === seriesSlug);
  if (!named) return null;
  const vehicles = await vehiclesOfSeries(catalog, [named.id]);
  const fits = await vehicleRequirementFits(catalog, vehicles);
  const [counts] = await publish.listedPartCounts(fits, [named.id]);
  if (!seriesHasPage(counts ?? { parts: 0, required: 0 })) return null;
  return {
    catalog,
    publish,
    scope,
    series: {
      ...vehicles[0].model.chassis.series,
      slug: seriesSlugOf(named.name),
    },
    vehicles,
    fits,
    places: await publish.listedSeriesParts(fits, named.id),
  };
}

type Place = NonNullable<Awaited<ReturnType<typeof placeOf>>>;

const partsByCategory = ({ places }: Place) => {
  const byCategory = new Map<string, string[]>();
  for (const { category_id, part_id } of places) {
    if (category_id) {
      byCategory.set(category_id, [
        ...(byCategory.get(category_id) ?? []),
        part_id,
      ]);
    }
  }
  return new Map(
    [...byCategory].filter(([, parts]) => seriesCategoryHasPage(parts.length)),
  );
};

const modelsWithParts = async ({
  catalog,
  vehicles,
  fits,
  places,
}: Place): Promise<Vehicle[][]> => {
  const listed = new Set(places.map(({ part_id }) => part_id));
  const fitments = await catalog.listFitments(
    { vehicle_id: vehicles.map(({ id }) => id) },
    { select: ['vehicle_id', 'part_id'], take: null },
  );
  const fittedBy = new Map<string, string[]>();
  for (const { vehicle_id, part_id } of fitments) {
    fittedBy.set(vehicle_id, [...(fittedBy.get(vehicle_id) ?? []), part_id]);
  }
  const byModel = new Map<string, Vehicle[]>();
  for (const vehicle of vehicles) {
    byModel.set(vehicle.model.slug, [
      ...(byModel.get(vehicle.model.slug) ?? []),
      vehicle,
    ]);
  }
  return [...byModel.values()].filter((group) => {
    const engineLess = group.filter(({ engine }) => engine === null);
    const ids = new Set(group.map(({ id }) => id));
    const parts = new Set(
      group.flatMap((vehicle) =>
        [vehicle, ...generationOf(vehicle, engineLess)]
          .flatMap(({ id }) => fittedBy.get(id) ?? [])
          .filter((id) => listed.has(id)),
      ),
    );
    const required = new Map<string, Set<string>>();
    for (const { vehicle_id, category_id, part_id } of fits) {
      if (ids.has(vehicle_id) && listed.has(part_id)) {
        required.set(
          category_id,
          (required.get(category_id) ?? new Set()).add(part_id),
        );
      }
    }
    for (const matched of required.values()) {
      if (requirementMatchesCount(matched.size)) {
        matched.forEach((id) => parts.add(id));
      }
    }
    return parts.size > 0;
  });
};

export const pagesOfParts = async (
  { catalog, publish, scope }: Pick<Place, 'catalog' | 'publish' | 'scope'>,
  partIds: string[],
  { locale, shown }: Options,
  only?: (identifierId: string) => boolean,
): Promise<SeriesPartPage[]> => {
  const identifiers = partIds.length
    ? await catalog.listPartIdentifiers(
        { part_id: partIds },
        { select: ['id'], order: { id: 'ASC' }, take: null },
      )
    : [];
  const ids = identifiers
    .map(({ id }) => id)
    .filter((id) => only?.(id) ?? true);
  const published = await publish.publishedNumbers(ids);
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

const shownCategories = async (catalog: CatalogModuleService, ids: string[]) =>
  (
    await catalog.listCategories(
      { id: ids },
      { relations: CATEGORY_RELATIONS, order: { slug: 'ASC' }, take: null },
    )
  ).map(shownCategory);

export async function seriesPageAt(
  scope: MedusaContainer,
  makeSlug: string,
  seriesSlug: string,
  options: Options,
): Promise<SeriesPageResponse | null> {
  const place = await placeOf(scope, makeSlug, seriesSlug);
  if (!place) return null;
  const byCategory = partsByCategory(place);
  const demand = await loadPartDemand(scope);
  return {
    series: place.series,
    models: (await modelsWithParts(place)).map((vehicles) => ({ vehicles })),
    categories: await shownCategories(place.catalog, [...byCategory.keys()]),
    popular: await pagesOfParts(
      place,
      distinct([...byCategory.values()].flat()),
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
  const partIds = category && partsByCategory(place).get(category.id);
  if (!category || !partIds) return null;
  const pages = await pagesOfParts(place, partIds, options);
  const fitments = await place.catalog.listFitments(
    {
      part_id: partIds,
      vehicle_id: place.vehicles.map(({ id }) => id),
    },
    { order: { id: 'ASC' }, take: null },
  );
  const vehicleById = new Map(place.vehicles.map((one) => [one.id, one]));
  return {
    series: place.series,
    category: shownCategory(category),
    parts: partIds.flatMap((id) => {
      const own = pages.filter(({ part }) => part.id === id);
      return own.length
        ? [
            {
              pages: own,
              fits: fitments
                .filter(({ part_id }) => part_id === id)
                .flatMap((row) => {
                  const vehicle = vehicleById.get(row.vehicle_id);
                  return vehicle
                    ? [{ ...toFitmentResponse(row), vehicle }]
                    : [];
                }),
            },
          ]
        : [];
    }),
  };
}
