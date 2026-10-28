import {
  enrichmentGaps,
  maintenanceKit,
  makeHasPage,
  MIN_PARTS_FOR_PAGE,
  modelHasPage,
  partPageSlug,
  positionGroups,
  requirementMatches,
  type Category,
  type CatalogueRedirect,
  type Fitment,
  type PartPage,
  type PositionGroup,
  type Vehicle,
  vehicleHasPage,
} from '@podbor/catalog-contract';
import { partSuccessor } from './partSuccessor';
import { modelKey, placeKey, vehicleKey, type CataloguePages } from './paths';

export const MODEL_CATEGORY_MIN_MATCHES = 1;

export type Fit = Fitment & { vehicle: Vehicle };

export type PartPageEntry = PartPage & {
  slug: string;
  indexable: boolean;
  priceOnRequest: boolean;
  category: Category | null;
  fits: Fit[];
  requirementCars: Vehicle[];
  kitCars: Vehicle[];
};

export type CategoryPageEntry = Category & { pages: PartPageEntry[] };

export type CarPart = Fit & {
  category_id: string | null;
  part: PartPage['part'];
  pages: PartPageEntry[];
};

export type CarPartGroup = PositionGroup<CarPart> & {
  category: Category | null;
};

type Make = Vehicle['model']['chassis']['series']['make'];

export type ModelPart = {
  part: PartPage['part'];
  pages: PartPageEntry[];
  fits: Fit[];
};

export type CarMatch = {
  category: Category;
  quantity: number;
  parts: ModelPart[];
};

export type CarKitItem = {
  category: Category;
  quantity: number;
  part: PartPage['part'];
  pages: PartPageEntry[];
};

export type CarPageEntry = {
  vehicle: Vehicle;
  groups: CarPartGroup[];
  matches: CarMatch[];
  kit: CarKitItem[];
};

export type ModelCategoryEntry = { category: Category; parts: ModelPart[] };

export type ModelHubEntry = {
  make: Make;
  model: Vehicle['model'];
  vehicles: Vehicle[];
  categories: ModelCategoryEntry[];
};

export type MakeHubEntry = {
  make: Make;
  models: ModelHubEntry[];
  parts: number;
};

const byName = new Intl.Collator('en', { numeric: true }).compare;

const groupBy = <T>(items: T[], key: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  }
  return groups;
};

export function assembleSnapshot(
  pages: PartPage[],
  allCategories: Category[],
  fitments: Fitment[],
  allVehicles: Vehicle[],
  redirects: CatalogueRedirect[] = [],
) {
  const categoryById = new Map(
    allCategories.map((category) => [category.id, category]),
  );
  const vehicleById = new Map(
    allVehicles.map((vehicle) => [vehicle.id, vehicle]),
  );
  const fits = fitments.flatMap((fitment) => {
    const vehicle = vehicleById.get(fitment.vehicle_id);
    return vehicle ? [{ ...fitment, vehicle }] : [];
  });
  const fitsByPart = groupBy(fits, ({ part_id }) => part_id);
  const bySlug = new Map<string, PartPageEntry>();
  for (const page of pages) {
    const slug = partPageSlug(page.brand.slug, page.normalized_value);
    if (bySlug.has(slug)) {
      continue;
    }
    const category = categoryById.get(page.part.category_id ?? '') ?? null;
    const partFits = fitsByPart.get(page.part.id) ?? [];
    bySlug.set(slug, {
      ...page,
      slug,
      indexable:
        enrichmentGaps({
          description: page.part.description,
          attributes: page.part.attributes,
          fitments: partFits.length,
          equivalents: page.equivalents.length,
        }).length === 0,
      priceOnRequest: page.offers.length === 0,
      category,
      fits: partFits,
      requirementCars: [],
      kitCars: [],
    });
  }
  const entries = [...bySlug.values()];
  const pagesByPart = groupBy(entries, ({ part }) => part.id);
  const retired = ({ replaced_by }: PartPage['part']) =>
    replaced_by !== null && pagesByPart.has(replaced_by.id);
  const parts = [...pagesByPart.values()].map((partPages) => ({
    ...partPages[0].part,
    pages: partPages,
  }));
  const matchesFor = (vehicle: Vehicle): CarMatch[] =>
    requirementMatches(parts, vehicle.requirements).flatMap(
      ({ category_id, quantity, parts: matched }) => {
        const category = categoryById.get(category_id);
        return category
          ? [
              {
                category,
                quantity,
                parts: matched.map(({ pages }) => ({
                  part: pages[0].part,
                  pages,
                  fits: [],
                })),
              },
            ]
          : [];
      },
    );
  const fitsByVehicle = groupBy(fits, ({ vehicle_id }) => vehicle_id);
  const partsFitting = (vehicles: Vehicle[]) =>
    new Set(
      vehicles.flatMap((vehicle) =>
        (fitsByVehicle.get(vehicle.id) ?? []).flatMap(({ part_id }) => {
          const partPages = pagesByPart.get(part_id);
          return partPages && !retired(partPages[0].part) ? [part_id] : [];
        }),
      ),
    );
  const cars = allVehicles.map((vehicle): CarPageEntry => {
    const candidates = (fitsByVehicle.get(vehicle.id) ?? []).flatMap((fit) => {
      const partPages = pagesByPart.get(fit.part_id);
      return partPages && !retired(partPages[0].part)
        ? [
            {
              ...fit,
              part: partPages[0].part,
              category_id: partPages[0].part.category_id,
              pages: partPages,
            },
          ]
        : [];
    });
    const groups = positionGroups(candidates, {
      steering: vehicle.steering ?? undefined,
    }).map((group) => ({
      ...group,
      category: categoryById.get(group.category_id ?? '') ?? null,
    }));
    const matches = matchesFor(vehicle);
    const kit = maintenanceKit(
      allCategories,
      groups,
      matches.map(({ category, quantity, parts: matched }) => ({
        category_id: category.id,
        quantity,
        parts: matched.map(({ part }) => part),
      })),
    ).flatMap(({ category_id, part_id, quantity }) => {
      const partPages = pagesByPart.get(part_id) ?? [];
      const category = categoryById.get(category_id);
      return category && partPages.length
        ? [{ category, quantity, part: partPages[0].part, pages: partPages }]
        : [];
    });
    return { vehicle, groups, matches, kit };
  });
  for (const { vehicle, matches, kit } of cars) {
    for (const { pages: partPages } of matches.flatMap(
      (match) => match.parts,
    )) {
      partPages.forEach((page) => page.requirementCars.push(vehicle));
    }
    for (const { pages: partPages } of kit) {
      partPages.forEach((page) => page.kitCars.push(vehicle));
    }
  }
  return {
    categories: allCategories,
    categoryById,
    vehicles: allVehicles,
    fits,
    entries,
    pagesByPart,
    retired,
    matchesFor,
    partsFitting,
    cars,
    redirects,
  };
}

export type CatalogueSnapshot = ReturnType<typeof assembleSnapshot>;

export function categoryPagesFrom({
  categories: all,
  entries,
}: CatalogueSnapshot): CategoryPageEntry[] {
  const bySlug = new Map(entries.map((page) => [page.slug, page]));
  const listed = entries.filter((page) => !partSuccessor(page, bySlug));
  return all.map((category) => ({
    ...category,
    pages: listed.filter((page) => page.category?.id === category.id),
  }));
}

const oncePerSnapshot = <T>(build: (snapshot: CatalogueSnapshot) => T) => {
  const built = new WeakMap<CatalogueSnapshot, T>();
  return (snapshot: CatalogueSnapshot): T => {
    if (!built.has(snapshot)) {
      built.set(snapshot, build(snapshot));
    }
    return built.get(snapshot) as T;
  };
};

export const makeHubsFrom = oncePerSnapshot(function makeHubs({
  categories: all,
  vehicles: allVehicles,
  pagesByPart,
  retired,
  matchesFor,
  partsFitting,
}: CatalogueSnapshot): MakeHubEntry[] {
  const parts = [...pagesByPart.values()].filter(
    (pages) => !retired(pages[0].part),
  );
  const models = [
    ...groupBy(allVehicles, ({ model }) => modelKey(model)).values(),
  ]
    .filter((vehicles) => modelHasPage(partsFitting(vehicles).size))
    .map((vehicles): ModelHubEntry => {
      const ids = new Set(vehicles.map(({ id }) => id));
      const { model } = vehicles[0];
      const required = vehicles.flatMap(matchesFor);
      return {
        make: model.chassis.series.make,
        model,
        vehicles,
        categories: all.flatMap((category) => {
          const fitted = parts.flatMap((pages) => {
            const fits = pages[0].fits.filter(({ vehicle_id }) =>
              ids.has(vehicle_id),
            );
            return pages[0].part.category_id === category.id && fits.length
              ? [{ part: pages[0].part, pages, fits }]
              : [];
          });
          const matches = [
            ...fitted,
            ...required
              .filter((match) => match.category.id === category.id)
              .flatMap((match) => match.parts),
          ].filter(
            (match, index, all) =>
              all.findIndex(({ part }) => part.id === match.part.id) === index,
          );
          return matches.length >= MODEL_CATEGORY_MIN_MATCHES
            ? [{ category, parts: matches }]
            : [];
        }),
      };
    });
  return [...groupBy(models, ({ make }) => make.slug).values()]
    .map((makeModels) => ({
      make: makeModels[0].make,
      models: makeModels,
      parts: partsFitting(makeModels.flatMap(({ vehicles }) => vehicles)).size,
    }))
    .filter(({ models: makeModels }) => makeHasPage(makeModels.length))
    .sort((a, b) => byName(a.make.name, b.make.name));
});

export function carPagesFrom({
  cars,
  partsFitting,
}: CatalogueSnapshot): CarPageEntry[] {
  const byModel = groupBy(cars, ({ vehicle }) => modelKey(vehicle.model));
  return [...byModel.values()].flatMap((modelCars) => {
    const modelParts = partsFitting(
      modelCars.map(({ vehicle }) => vehicle),
    ).size;
    const parts = modelCars.map(({ vehicle }) => partsFitting([vehicle]).size);
    const modelVehiclesWithEnoughParts = parts.filter(
      (count) => count >= MIN_PARTS_FOR_PAGE,
    ).length;
    return modelCars.filter((_, index) =>
      vehicleHasPage({
        parts: parts[index],
        modelParts,
        modelVehiclesWithEnoughParts,
      }),
    );
  });
}

export const cataloguePagesFrom = oncePerSnapshot(function cataloguePages(
  snapshot: CatalogueSnapshot,
): CataloguePages {
  const hubs = makeHubsFrom(snapshot);
  const models = hubs.flatMap(({ models: makeModels }) => makeModels);
  return {
    makes: new Set(hubs.map(({ make }) => make.slug)),
    models: new Set(models.map(({ model }) => modelKey(model))),
    categories: new Set(
      models.flatMap(({ model, categories }) =>
        categories.map(({ category }) =>
          placeKey(modelKey(model), category.slug),
        ),
      ),
    ),
    vehicles: new Set(
      carPagesFrom(snapshot).map(({ vehicle }) => vehicleKey(vehicle)),
    ),
  };
});

export const CATEGORY_PAGE_SIZE = 48;

export type CategoryListing = {
  number: number;
  count: number;
  pages: PartPageEntry[];
};

export function categoryListings({
  pages,
}: CategoryPageEntry): CategoryListing[] {
  const count = Math.max(1, Math.ceil(pages.length / CATEGORY_PAGE_SIZE));
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    count,
    pages: pages.slice(
      index * CATEGORY_PAGE_SIZE,
      (index + 1) * CATEGORY_PAGE_SIZE,
    ),
  }));
}
