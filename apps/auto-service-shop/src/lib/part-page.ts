import type { MedusaContainer } from '@medusajs/framework/types';
import {
  enrichmentGaps,
  generationOf,
  partPageSchema,
  partPageSlug,
  positionGroups,
  requirementMatches,
  translated,
  type CatalogLocale,
  type Fitment,
  type LinkedSeries,
  type PartPage,
  type PartPageResponse,
  type Vehicle,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { CATEGORY_RELATIONS, shownCategory } from './categories';
import { loadPartDemand } from './part-demand';
import { partPagesOf } from './part-pages';
import { requirementFits } from './requirement-fit';
import {
  type CatalogueModules,
  catalogueModules,
  pagedSeries,
} from './series-pages';
import { listVehicleResponses, toFitmentResponse } from './store-response';

const distinct = <T>(values: T[]) => [...new Set(values)];

const byId = <Row extends { id: string }>(rows: Row[]) =>
  [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

const slugAddress = (slug: string): [string, string] | null => {
  const at = slug.lastIndexOf('-');
  return at > 0 ? [slug.slice(0, at), slug.slice(at + 1).toUpperCase()] : null;
};

export const slugOf = (page: PartPage) =>
  partPageSlug(page.brand.slug, page.normalized_value);

export const localizedFit = (fit: Fitment, locale: CatalogLocale) => ({
  ...fit,
  note: fit.note && translated({ ...fit, note: fit.note }, 'note', locale),
  translations: null,
});

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
  modules: CatalogueModules,
  vehicleIds: string[],
): Promise<LinkedSeries[]> {
  const { catalog } = modules;
  if (!vehicleIds.length) return [];
  const rows = await catalog.listVehicles(
    { id: vehicleIds },
    { relations: ['model', 'model.chassis'], take: null },
  );
  const seriesIds = distinct(rows.map(({ model }) => model.chassis.series_id));
  return (await pagedSeries(modules, seriesIds))
    .map(({ name, make }) => ({ make: make.slug, slug: seriesSlugOf(name) }))
    .sort((a, b) => `${a.make}/${a.slug}`.localeCompare(`${b.make}/${b.slug}`));
}

async function kitCars(
  { catalog, publish }: CatalogueModules,
  part: PartPage['part'] & { category_id: string },
  fitted: Vehicle[],
  required: Vehicle[],
): Promise<Vehicle[]> {
  const listed = await publish.listedPartsIn(part.category_id);
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
  const modules = catalogueModules(scope);
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
  const fits = fitments
    .map(toFitmentResponse)
    .filter(({ vehicle_id }) => vehicleById.has(vehicle_id))
    .map((fit) => localizedFit(fit, locale));

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
      requirement_cars: requirementCars.map(({ id }) => id),
      kit_cars: kit.map(({ id }) => id),
    },
    related: related.map((other) => ({
      ...localized(other, locale),
      slug: slugOf(other),
      category: categoryOf(other),
    })),
    vehicles: byId([...fitVehicles, ...requirementCars, ...kit]),
    linked_series: await seriesLinks(
      modules,
      distinct(
        [...fitVehicles, ...requirementCars, ...kit].map(({ id }) => id),
      ),
    ),
  };
}
