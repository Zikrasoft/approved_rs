import { paginate } from '@podbor/site-kit/pagination';
import {
  enrichmentGaps,
  generationOf,
  maintenanceKit,
  makeHasPage,
  partPageSlug,
  positionGroups,
  requirementMatches,
  requirementMatchesCount,
  seriesCategoryHasPage,
  seriesHasPage,
  type Category,
  type CatalogueRedirect,
  type Fitment,
  type PartPage,
  type PlaceParts,
  type PositionGroup,
  type Vehicle,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';
import { byModelName } from './carName';
import { partSuccessor } from './partSuccessor';
import { placeKey, seriesKey, type CataloguePages } from './paths';

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
  generation: boolean;
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

export type SeriesCategoryEntry = { category: Category; parts: ModelPart[] };

type Series = Vehicle['model']['chassis']['series'];

export type SeriesModel = { model: Vehicle['model']; vehicles: Vehicle[] };

export type SeriesHubEntry = {
  make: Make;
  series: Series & { slug: string };
  models: SeriesModel[];
  categories: SeriesCategoryEntry[];
};

export type MakeHubEntry = {
  make: Make;
  series: SeriesHubEntry[];
  parts: number;
};

const byName = new Intl.Collator('en', { numeric: true }).compare;

const modelKey = ({ slug, chassis }: Vehicle['model']) =>
  placeKey(chassis.series.make.slug, slug);

const seriesKeyOf = ({ model }: Vehicle) => seriesKey(model.chassis.series);

const groupBy = <T>(items: T[], key: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const itemKey = key(item);
    const group = groups.get(itemKey);
    if (group) {
      group.push(item);
    } else {
      groups.set(itemKey, [item]);
    }
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
  const retired = ({ id, replaced_by }: PartPage['part']) => {
    const partPages = pagesByPart.get(id) ?? [];
    return partPages.some(({ listed }) => listed !== null)
      ? !partPages.some(({ listed }) => listed)
      : replaced_by !== null && pagesByPart.has(replaced_by.id);
  };
  const parts = [...pagesByPart.values()].map((partPages) => ({
    ...partPages[0].part,
    pages: partPages,
  }));
  const listedParts = parts.filter((part) => !retired(part));
  const matchesFor = (vehicle: Vehicle): CarMatch[] =>
    requirementMatches(listedParts, vehicle.requirements).flatMap(
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
  const engineLessByModel = groupBy(
    allVehicles.filter(({ engine }) => engine === null),
    ({ model }) => modelKey(model),
  );
  const carFits = (vehicle: Vehicle) => {
    const own = fitsByVehicle.get(vehicle.id) ?? [];
    const seen = new Set(own.map(({ part_id }) => part_id));
    const borrowed = generationOf(
      vehicle,
      engineLessByModel.get(modelKey(vehicle.model)) ?? [],
    )
      .flatMap(({ id }) => fitsByVehicle.get(id) ?? [])
      .filter(({ part_id }) => !seen.has(part_id) && seen.add(part_id));
    return [
      ...own.map((fit) => ({ ...fit, generation: false })),
      ...borrowed.map((fit) => ({ ...fit, generation: true })),
    ];
  };
  const cars = allVehicles.map((vehicle): CarPageEntry => {
    const candidates = carFits(vehicle).flatMap((fit) => {
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
  const matchesByVehicle = new Map(
    cars.map(({ vehicle, matches }) => [vehicle.id, matches]),
  );
  const fittedParts = (vehicle: Vehicle) =>
    carFits(vehicle).flatMap(({ part_id }) => {
      const partPages = pagesByPart.get(part_id);
      return partPages && !retired(partPages[0].part) ? [part_id] : [];
    });
  const placeParts = (vehicles: Vehicle[]): PlaceParts => {
    const required = new Map<string, Set<string>>();
    for (const vehicle of vehicles) {
      for (const match of matchesByVehicle.get(vehicle.id) ?? []) {
        const matched = required.get(match.category.id) ?? new Set<string>();
        required.set(match.category.id, matched);
        match.parts.forEach(({ part }) => matched.add(part.id));
      }
    }
    const counted = [...required.values()].filter(({ size }) =>
      requirementMatchesCount(size),
    );
    return {
      parts: new Set([
        ...vehicles.flatMap(fittedParts),
        ...counted.flatMap((matched) => [...matched]),
      ]).size,
      required: Math.max(0, ...[...required.values()].map(({ size }) => size)),
    };
  };
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
    placeParts,
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
  const listed = entries.filter(
    (page) => page.listed ?? !partSuccessor(page, bySlug),
  );
  return all.map((category) => ({
    ...category,
    pages: listed.filter((page) => page.category?.id === category.id),
  }));
}

const oncePerSnapshot = <T>(
  name: string,
  build: (snapshot: CatalogueSnapshot) => T,
) => {
  const key = Symbol.for(`carlab.snapshot.${name}`);
  const holder = globalThis as Record<
    symbol,
    WeakMap<CatalogueSnapshot, T> | undefined
  >;
  return (snapshot: CatalogueSnapshot): T => {
    const built = (holder[key] ??= new WeakMap());
    if (!built.has(snapshot)) {
      built.set(snapshot, build(snapshot));
    }
    return built.get(snapshot) as T;
  };
};

const fittedBySeries = (
  parts: PartPageEntry[][],
): Map<string, Map<string, ModelPart[]>> => {
  const bySeries = new Map<string, Map<string, ModelPart[]>>();
  for (const pages of parts) {
    const { part } = pages[0];
    if (part.category_id === null) {
      continue;
    }
    const entries = new Map<string, ModelPart>();
    for (const fit of pages[0].fits) {
      const key = seriesKeyOf(fit.vehicle);
      const entry = entries.get(key);
      if (entry) {
        entry.fits.push(fit);
        continue;
      }
      const created = { part, pages, fits: [fit] };
      entries.set(key, created);
      const byCategory = bySeries.get(key) ?? new Map<string, ModelPart[]>();
      bySeries.set(key, byCategory);
      const listed = byCategory.get(part.category_id) ?? [];
      byCategory.set(part.category_id, listed);
      listed.push(created);
    }
  }
  return bySeries;
};

const firstOfEachPart = (parts: ModelPart[]): ModelPart[] => {
  const seen = new Set<string>();
  return parts.filter(({ part }) => !seen.has(part.id) && seen.add(part.id));
};

export const makeHubsFrom = oncePerSnapshot(
  'makeHubs',
  function makeHubs({
    categories: all,
    cars,
    pagesByPart,
    retired,
    placeParts,
  }: CatalogueSnapshot): MakeHubEntry[] {
    const fitted = fittedBySeries(
      [...pagesByPart.values()].filter((pages) => !retired(pages[0].part)),
    );
    const series = [
      ...groupBy(cars, ({ vehicle }) => seriesKeyOf(vehicle)).entries(),
    ]
      .map(([key, seriesCars]) => ({
        key,
        vehicles: seriesCars.map(({ vehicle }) => vehicle),
        required: groupBy(
          seriesCars.flatMap(({ matches }) => matches),
          ({ category }) => category.id,
        ),
      }))
      .filter(({ vehicles }) => seriesHasPage(placeParts(vehicles)))
      .map(({ key, vehicles, required }): SeriesHubEntry => {
        const { series: named } = vehicles[0].model.chassis;
        const seriesFitted = fitted.get(key);
        return {
          make: named.make,
          series: { ...named, slug: seriesSlugOf(named.name) },
          models: [
            ...groupBy(vehicles, ({ model }) => modelKey(model)).values(),
          ]
            .filter((modelVehicles) => placeParts(modelVehicles).parts > 0)
            .map((modelVehicles) => ({
              model: modelVehicles[0].model,
              vehicles: modelVehicles,
            }))
            .toSorted(byModelName),
          categories: all.flatMap((category) => {
            const parts = firstOfEachPart([
              ...(seriesFitted?.get(category.id) ?? []),
              ...(required.get(category.id) ?? []).flatMap(
                (match) => match.parts,
              ),
            ]);
            return seriesCategoryHasPage(parts.length)
              ? [{ category, parts }]
              : [];
          }),
        };
      });
    return [...groupBy(series, ({ make }) => make.slug).values()]
      .map((makeSeries) => ({
        make: makeSeries[0].make,
        series: makeSeries.toSorted((a, b) =>
          byName(a.series.name, b.series.name),
        ),
        parts: placeParts(
          makeSeries.flatMap(({ models }) =>
            models.flatMap(({ vehicles }) => vehicles),
          ),
        ).parts,
      }))
      .filter(({ series: makeSeries }) => makeHasPage(makeSeries.length))
      .sort((a, b) => byName(a.make.name, b.make.name));
  },
);

export const cataloguePagesFrom = oncePerSnapshot(
  'cataloguePages',
  function cataloguePages(snapshot: CatalogueSnapshot): CataloguePages {
    const hubs = makeHubsFrom(snapshot);
    const series = hubs.flatMap(({ series: makeSeries }) => makeSeries);
    return {
      makes: new Set(hubs.map(({ make }) => make.slug)),
      series: new Set(series.map((hub) => seriesKey(hub.series))),
      categories: new Set(
        series.flatMap((hub) =>
          hub.categories.map(({ category }) =>
            placeKey(seriesKey(hub.series), category.slug),
          ),
        ),
      ),
    };
  },
);

export const CATEGORY_PAGE_SIZE = 48;

export type CategoryListing = {
  number: number;
  count: number;
  pages: PartPageEntry[];
};

export function categoryListings({
  pages,
}: CategoryPageEntry): CategoryListing[] {
  return paginate(pages, CATEGORY_PAGE_SIZE).map(
    ({ number, count, items }) => ({
      number,
      count,
      pages: items,
    }),
  );
}
