import {
  categoriesResponseSchema,
  partPageSlug,
  partPagesResponseSchema,
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  type Category,
  type PartPage,
  type Vehicle,
  type VinFacts,
} from '@podbor/catalog-contract';

export type { Vehicle, VinFacts };

export const CATALOGUE_TIMEOUT_MS = 10_000;
const PART_PAGES_BATCH = 1000;

export type PartPageEntry = PartPage & {
  slug: string;
  indexable: boolean;
  priceOnRequest: boolean;
  category: Category | null;
};

export type CategoryPageEntry = Category & { pages: PartPageEntry[] };

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

  const categories = async (): Promise<Category[]> =>
    categoriesResponseSchema.parse(await request('/store/categories'))
      .categories;

  const allPartPages = async (): Promise<PartPage[]> => {
    const all: PartPage[] = [];
    for (let offset = 0; ;) {
      const { pages, count } = partPagesResponseSchema.parse(
        await request(
          `/store/part-pages?offset=${offset}&limit=${PART_PAGES_BATCH}`,
        ),
      );
      all.push(...pages);
      offset += pages.length;
      if (pages.length === 0 || offset >= count) {
        return all;
      }
    }
  };

  const partPages = async (known?: Category[]): Promise<PartPageEntry[]> => {
    const pages = await allPartPages();
    const byId = new Map(
      (pages.some(({ part }) => part.category_id)
        ? (known ?? (await categories()))
        : []
      ).map((category) => [category.id, category]),
    );
    const bySlug = new Map<string, PartPageEntry>();
    for (const page of pages) {
      const slug = partPageSlug(page.brand.slug, page.normalized_value);
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          ...page,
          slug,
          indexable: false,
          priceOnRequest: !page.has_offers,
          category: byId.get(page.part.category_id ?? '') ?? null,
        });
      }
    }
    return [...bySlug.values()];
  };

  return {
    categories,
    partPages: () => partPages(),

    async categoryPages(): Promise<CategoryPageEntry[]> {
      const all = await categories();
      const pages = await partPages(all);
      return all.map((category) => ({
        ...category,
        pages: pages.filter((page) => page.category?.id === category.id),
      }));
    },

    async vehicles(): Promise<Vehicle[]> {
      return vehiclesResponseSchema.parse(await request('/store/vehicles'))
        .vehicles;
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
