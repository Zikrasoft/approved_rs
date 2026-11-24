import type { MedusaContainer } from '@medusajs/framework/types';
import {
  attributeValuesSchema,
  enrichmentGaps,
  generationOf,
  partPageSchema,
  partPageSlug,
  positionGroups,
  requirementMatches,
  seriesHasPage,
  translated,
  type CatalogLocale,
  type LinkedSeries,
  type PartPage,
  type PartPageResponse,
  type Vehicle,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';
import { CATEGORY_RELATIONS, shownCategory } from './categories';
import { loadPartDemand } from './part-demand';
import { partPagesOf } from './part-pages';
import { requirementFits, vehicleRequirementFits } from './requirement-fit';
import { listVehicleResponses, toFitmentResponse } from './store-response';

type Modules = { catalog: CatalogModuleService; publish: PublishModuleService };

const distinct = <T>(values: T[]) => [...new Set(values)];

const byId = <Row extends { id: string }>(rows: Row[]) =>
  [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

const slugAddress = (slug: string): [string, string] | null => {
  const at = slug.lastIndexOf('-');
  return at > 0 ? [slug.slice(0, at), slug.slice(at + 1).toUpperCase()] : null;
};

const slugOf = (page: PartPage) =>
  partPageSlug(page.brand.slug, page.normalized_value);

export const localized = (page: PartPage, locale: CatalogLocale): PartPage => {
  const { part } = page;
  return {
    ...page,
    part: {
      ...part,
      name: translated(part, 'name', locale),
      description:
        part.description &&
        translated(
          { ...part, description: part.description },
          'description',
          locale,
        ),
      translations: null,
      replaced_by: part.replaced_by && {
        ...part.replaced_by,
        name: translated(part.replaced_by, 'name', locale),
        translations: null,
      },
    },
  };
};

async function seriesLinks(
  { catalog, publish }: Modules,
  vehicleIds: string[],
): Promise<LinkedSeries[]> {
  if (!vehicleIds.length) return [];
  const rows = await catalog.listVehicles(
    { id: vehicleIds },
    { relations: ['model', 'model.chassis'], take: null },
  );
  const seriesIds = distinct(rows.map(({ model }) => model.chassis.series_id));
  const chassis = await catalog.listChassis(
    { series_id: seriesIds },
    { select: ['id'], take: null },
  );
  const models = await catalog.listVehicleModels(
    { chassis_id: chassis.map(({ id }) => id) },
    { select: ['id'], take: null },
  );
  const vehicles = await listVehicleResponses(catalog, {
    model_id: models.map(({ id }) => id),
  });
  const counts = await publish.listedPartCounts(
    await vehicleRequirementFits(catalog, vehicles),
    seriesIds,
  );
  const series = await catalog.listSeries(
    { id: seriesIds },
    { relations: ['make'], take: null },
  );
  return series
    .filter(({ id }) =>
      seriesHasPage(
        counts.find(({ series_id }) => series_id === id) ?? {
          parts: 0,
          required: 0,
        },
      ),
    )
    .map(({ name, make }) => ({ make: make.slug, slug: seriesSlugOf(name) }))
    .sort((a, b) => `${a.make}/${a.slug}`.localeCompare(`${b.make}/${b.slug}`));
}

async function kitCars(
  { catalog, publish }: Modules,
  part: PartPage['part'] & { category_id: string },
  fitted: Vehicle[],
  required: Vehicle[],
): Promise<Vehicle[]> {
  const listed = (await publish.listedPartsIn(part.category_id)).map((row) => ({
    ...row,
    attributes: attributeValuesSchema.parse(row.attributes),
  }));
  const seeds = byId([...fitted, ...required]);
  const models = await catalog.listVehicleModels(
    { slug: distinct(seeds.map(({ model }) => model.slug)) },
    { select: ['id'], take: null },
  );
  const sameModel = models.length
    ? await listVehicleResponses(catalog, {
        model_id: models.map(({ id }) => id),
      })
    : [];
  const engineLess = sameModel.filter(({ engine }) => engine === null);
  const fittedIds = new Set(fitted.map(({ id }) => id));
  const candidates = byId([
    ...seeds,
    ...sameModel.filter(
      (vehicle) =>
        generationOf(
          vehicle,
          engineLess.filter(({ id }) => fittedIds.has(id)),
        ).length > 0,
    ),
  ]);
  const fitments = (
    await catalog.listFitments(
      {
        vehicle_id: distinct(
          [...candidates, ...engineLess].map(({ id }) => id),
        ),
        part_id: listed.map(({ id }) => id),
      },
      { order: { id: 'ASC' }, take: null },
    )
  ).map((row) => ({
    ...toFitmentResponse(row),
    category_id: part.category_id,
  }));
  const fitsOf = (vehicle: Vehicle) =>
    fitments.filter(({ vehicle_id }) => vehicle_id === vehicle.id);
  const kitPart = (vehicle: Vehicle) => {
    const own = fitsOf(vehicle);
    const seen = new Set(own.map(({ part_id }) => part_id));
    const borrowed = generationOf(vehicle, engineLess)
      .flatMap(fitsOf)
      .filter(({ part_id }) => !seen.has(part_id) && seen.add(part_id));
    const group = positionGroups([...own, ...borrowed], {
      steering: vehicle.steering ?? undefined,
    }).find(({ ambiguous }) => !ambiguous);
    return group
      ? group.fitments[0].part_id
      : requirementMatches(listed, vehicle.requirements)[0]?.parts[0]?.id;
  };
  return candidates.filter((vehicle) => kitPart(vehicle) === part.id);
}

export async function partPageAt(
  scope: MedusaContainer,
  slug: string,
  { locale, shown }: { locale: CatalogLocale; shown: boolean },
): Promise<PartPageResponse | null> {
  const address = slugAddress(slug);
  const modules: Modules = {
    catalog: scope.resolve(CATALOG_MODULE),
    publish: scope.resolve(PUBLISH_MODULE),
  };
  const { catalog, publish } = modules;
  const own = address && (await publish.publishedBySlug(...address));
  if (!own) return null;
  const options = { shown, demand: await loadPartDemand(scope) };
  const pagesOf = async (rows: (typeof own)[]) =>
    (await partPagesOf(scope, rows, options)).map((page) =>
      partPageSchema.parse(page),
    );
  const [page] = await pagesOf([own]);
  const { part } = page;
  const replacementIds = part.replaced_by
    ? (
        await catalog.listPartIdentifiers(
          { part_id: part.replaced_by.id },
          { select: ['id'], take: null },
        )
      ).map(({ id }) => id)
    : [];
  const equivalentIds = new Set(page.equivalents.map(({ id }) => id));
  const relatedRows = await publish.publishedNumbers([
    ...equivalentIds,
    ...replacementIds,
  ]);
  const retired = ![own, ...relatedRows]
    .filter(({ id }) => id === own.id || equivalentIds.has(id))
    .some(({ listed }) => listed);
  const seen = new Set([slugOf(page)]);
  const related = (await pagesOf(relatedRows)).filter(
    (other) => !seen.has(slugOf(other)) && seen.add(slugOf(other)),
  );

  const categories = new Map(
    (
      await catalog.listCategories(
        {
          id: distinct(
            [page, ...related].flatMap(({ part: { category_id } }) =>
              category_id ? [category_id] : [],
            ),
          ),
        },
        { relations: CATEGORY_RELATIONS, take: null },
      )
    ).map((category) => [category.id, shownCategory(category)]),
  );
  const categoryOf = ({ part: { category_id } }: PartPage) =>
    categories.get(category_id ?? '') ?? null;

  const fitments = await catalog.listFitments(
    { part_id: part.id },
    { order: { id: 'ASC' }, take: null },
  );
  const fitVehicles = fitments.length
    ? await listVehicleResponses(catalog, {
        id: distinct(fitments.map(({ vehicle_id }) => vehicle_id)),
      })
    : [];
  const vehicleById = new Map(
    fitVehicles.map((vehicle) => [vehicle.id, vehicle]),
  );
  const fits = fitments.flatMap((row) => {
    const vehicle = vehicleById.get(row.vehicle_id);
    return vehicle ? [{ ...toFitmentResponse(row), vehicle }] : [];
  });

  const requirementCars = retired
    ? []
    : byId(
        (await requirementFits(catalog, [part])).map(({ vehicle }) => vehicle),
      );
  const category = categoryOf(page);
  const kit =
    category?.maintenance_kit && !retired && part.category_id
      ? await kitCars(
          modules,
          { ...part, category_id: part.category_id },
          fitVehicles,
          requirementCars,
        )
      : [];

  return {
    page: {
      ...localized(page, locale),
      slug: slugOf(page),
      category,
      indexable:
        enrichmentGaps({
          description: part.description,
          attributes: part.attributes,
          fitments: fits.length,
          equivalents: page.equivalents.length,
        }).length === 0,
      fits,
      requirement_cars: requirementCars,
      kit_cars: kit,
    },
    related: related.map((other) => ({
      ...localized(other, locale),
      slug: slugOf(other),
      category: categoryOf(other),
    })),
    linked_series: await seriesLinks(
      modules,
      distinct(
        [...fitVehicles, ...requirementCars, ...kit].map(({ id }) => id),
      ),
    ),
  };
}
