import {
  categoriesResponseSchema,
  fitmentsResponseSchema,
  partPageSlug,
  partPagesResponseSchema,
  positionGroups,
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  type Category,
  type Fitment,
  type PartPage,
  type PositionGroup,
  type Vehicle,
  type VinFacts,
} from '@podbor/catalog-contract';

export type { Vehicle, VinFacts };

export const CATALOGUE_TIMEOUT_MS = 10_000;
export const MODEL_CATEGORY_MIN_MATCHES = 1;
const PAGE_BATCH = 1000;

export type Fit = Fitment & { vehicle: Vehicle };

export type PartPageEntry = PartPage & {
  slug: string;
  indexable: boolean;
  priceOnRequest: boolean;
  category: Category | null;
  fits: Fit[];
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

export type CarPageEntry = { vehicle: Vehicle; groups: CarPartGroup[] };

type Make = Vehicle['model']['chassis']['series']['make'];

export type ModelPart = {
  part: PartPage['part'];
  pages: PartPageEntry[];
  fits: Fit[];
};

export type ModelCategoryEntry = { category: Category; parts: ModelPart[] };

export type ModelHubEntry = {
  make: Make;
  model: Vehicle['model'];
  vehicles: Vehicle[];
  categories: ModelCategoryEntry[];
};

export type MakeHubEntry = { make: Make; models: ModelHubEntry[] };

export type VinOutcome =
  | { kind: 'vehicle'; vehicle: Vehicle; facts: VinFacts }
  | { kind: 'inquiry'; vin: string };

export type CatalogueConfig = {
  backendUrl: string;
  publishableKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

export type CatalogueEnv = {
  MEDUSA_BACKEND_URL?: string;
  MEDUSA_PUBLISHABLE_KEY?: string;
};

const groupBy = <T>(items: T[], key: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  }
  return groups;
};

export function createCatalogue({
  backendUrl,
  publishableKey,
  fetch = globalThis.fetch,
  timeoutMs = CATALOGUE_TIMEOUT_MS,
}: CatalogueConfig) {
  const request = async (path: string, body?: unknown): Promise<unknown> => {
    const response = await fetch(`${backendUrl}${path}`, {
      headers: { 'x-publishable-api-key': publishableKey },
      ...(body !== undefined && {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-publishable-api-key': publishableKey,
        },
        body: JSON.stringify(body),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Catalogue ${path} answered ${response.status}`);
    }
    return response.json();
  };

  const paged = async <T>(
    path: string,
    read: (body: unknown) => { items: T[]; count: number },
  ): Promise<T[]> => {
    const all: T[] = [];
    for (let offset = 0; ;) {
      const { items, count } = read(
        await request(`${path}?offset=${offset}&limit=${PAGE_BATCH}`),
      );
      all.push(...items);
      offset += items.length;
      if (items.length === 0 || offset >= count) {
        return all;
      }
    }
  };

  const categories = async (): Promise<Category[]> =>
    categoriesResponseSchema.parse(await request('/store/categories'))
      .categories;

  const vehicles = async (): Promise<Vehicle[]> =>
    vehiclesResponseSchema.parse(await request('/store/vehicles')).vehicles;

  const snapshot = async () => {
    const [pages, allCategories, fitments, allVehicles] = await Promise.all([
      paged('/store/part-pages', (body) => {
        const { pages, count } = partPagesResponseSchema.parse(body);
        return { items: pages, count };
      }),
      categories(),
      paged('/store/fitments', (body) => {
        const { fitments, count } = fitmentsResponseSchema.parse(body);
        return { items: fitments, count };
      }),
      vehicles(),
    ]);
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
        indexable: Boolean(
          category && (partFits.length > 0 || page.equivalents.length > 0),
        ),
        priceOnRequest: !page.has_offers,
        category,
        fits: partFits,
      });
    }
    const entries = [...bySlug.values()];
    return {
      categories: allCategories,
      categoryById,
      vehicles: allVehicles,
      fits,
      entries,
      pagesByPart: groupBy(entries, ({ part }) => part.id),
    };
  };

  return {
    categories,
    vehicles,

    async partPages(): Promise<PartPageEntry[]> {
      return (await snapshot()).entries;
    },

    async categoryPages(): Promise<CategoryPageEntry[]> {
      const { categories: all, entries } = await snapshot();
      return all.map((category) => ({
        ...category,
        pages: entries.filter((page) => page.category?.id === category.id),
      }));
    },

    async carPages(): Promise<CarPageEntry[]> {
      const {
        vehicles: all,
        fits,
        pagesByPart,
        categoryById,
      } = await snapshot();
      const fitsByVehicle = groupBy(fits, ({ vehicle_id }) => vehicle_id);
      return all.map((vehicle) => {
        const candidates = (fitsByVehicle.get(vehicle.id) ?? []).flatMap(
          (fit) => {
            const pages = pagesByPart.get(fit.part_id);
            return pages
              ? [
                  {
                    ...fit,
                    part: pages[0].part,
                    category_id: pages[0].part.category_id,
                    pages,
                  },
                ]
              : [];
          },
        );
        return {
          vehicle,
          groups: positionGroups(candidates, {
            steering: vehicle.steering ?? undefined,
          }).map((group) => ({
            ...group,
            category: categoryById.get(group.category_id ?? '') ?? null,
          })),
        };
      });
    },

    async makeHubs(): Promise<MakeHubEntry[]> {
      const {
        categories: all,
        vehicles: allVehicles,
        pagesByPart,
      } = await snapshot();
      const parts = [...pagesByPart.values()];
      const models = [
        ...groupBy(allVehicles, ({ model }) => model.slug).values(),
      ].map((vehicles): ModelHubEntry => {
        const ids = new Set(vehicles.map(({ id }) => id));
        const { model } = vehicles[0];
        return {
          make: model.chassis.series.make,
          model,
          vehicles,
          categories: all.flatMap((category) => {
            const matches = parts.flatMap((pages) => {
              const fits = pages[0].fits.filter(({ vehicle_id }) =>
                ids.has(vehicle_id),
              );
              return pages[0].part.category_id === category.id && fits.length
                ? [{ part: pages[0].part, pages, fits }]
                : [];
            });
            return matches.length >= MODEL_CATEGORY_MIN_MATCHES
              ? [{ category, parts: matches }]
              : [];
          }),
        };
      });
      return [...groupBy(models, ({ make }) => make.slug).values()].map(
        (makeModels) => ({ make: makeModels[0].make, models: makeModels }),
      );
    },

    async resolveVin(vin: string): Promise<VinOutcome> {
      try {
        const lookup = vinLookupResponseSchema.parse(
          await request('/store/vin-lookups', { vin }),
        );
        return lookup.resolved
          ? { kind: 'vehicle', vehicle: lookup.vehicle, facts: lookup.facts }
          : { kind: 'inquiry', vin };
      } catch {
        return { kind: 'inquiry', vin };
      }
    },
  };
}

export function catalogueFromEnv(env: CatalogueEnv) {
  return env.MEDUSA_BACKEND_URL
    ? createCatalogue({
        backendUrl: env.MEDUSA_BACKEND_URL,
        publishableKey: env.MEDUSA_PUBLISHABLE_KEY ?? '',
      })
    : null;
}

const buildEnv = (): CatalogueEnv => ({
  MEDUSA_BACKEND_URL: import.meta.env.MEDUSA_BACKEND_URL,
  MEDUSA_PUBLISHABLE_KEY: import.meta.env.MEDUSA_PUBLISHABLE_KEY,
});

export async function partPagesForBuild(
  env = buildEnv(),
): Promise<PartPageEntry[]> {
  return (await catalogueFromEnv(env)?.partPages()) ?? [];
}

export async function categoriesForBuild(
  env = buildEnv(),
): Promise<Category[]> {
  return (await catalogueFromEnv(env)?.categories()) ?? [];
}

export async function categoryPagesForBuild(
  env = buildEnv(),
): Promise<CategoryPageEntry[]> {
  return (await catalogueFromEnv(env)?.categoryPages()) ?? [];
}

export async function vehiclesForBuild(env: CatalogueEnv): Promise<Vehicle[]> {
  return (await catalogueFromEnv(env)?.vehicles()) ?? [];
}

export async function carPagesForBuild(
  env = buildEnv(),
): Promise<CarPageEntry[]> {
  return (await catalogueFromEnv(env)?.carPages()) ?? [];
}

export async function makeHubsForBuild(
  env = buildEnv(),
): Promise<MakeHubEntry[]> {
  return (await catalogueFromEnv(env)?.makeHubs()) ?? [];
}
