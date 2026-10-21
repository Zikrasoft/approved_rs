import {
  categoriesResponseSchema,
  partPageSlug,
  partPagesResponseSchema,
  type Category,
  type PartPage,
} from '@podbor/catalog-contract';

export const CATALOGUE_TIMEOUT_MS = 10_000;
const PART_PAGES_BATCH = 1000;

export type PartPageEntry = PartPage & {
  slug: string;
  indexable: boolean;
  category: Category | null;
};

export type CategoryPageEntry = Category & { pages: PartPageEntry[] };

export type CatalogueConfig = {
  backendUrl: string;
  publishableKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

type BuildEnv = {
  MEDUSA_BACKEND_URL?: string;
  MEDUSA_PUBLISHABLE_KEY?: string;
};

export function createCatalogue({
  backendUrl,
  publishableKey,
  fetch = globalThis.fetch,
  timeoutMs = CATALOGUE_TIMEOUT_MS,
}: CatalogueConfig) {
  const get = async (path: string): Promise<unknown> => {
    const response = await fetch(`${backendUrl}${path}`, {
      headers: { 'x-publishable-api-key': publishableKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Catalogue ${path} answered ${response.status}`);
    }
    return response.json();
  };

  const categories = async (): Promise<Category[]> =>
    categoriesResponseSchema.parse(await get('/store/categories')).categories;

  const allPartPages = async (): Promise<PartPage[]> => {
    const all: PartPage[] = [];
    for (let offset = 0; ;) {
      const { pages, count } = partPagesResponseSchema.parse(
        await get(
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
  };
}

const catalogueFor = (
  env: BuildEnv = {
    MEDUSA_BACKEND_URL: import.meta.env.MEDUSA_BACKEND_URL,
    MEDUSA_PUBLISHABLE_KEY: import.meta.env.MEDUSA_PUBLISHABLE_KEY,
  },
) =>
  env.MEDUSA_BACKEND_URL
    ? createCatalogue({
        backendUrl: env.MEDUSA_BACKEND_URL,
        publishableKey: env.MEDUSA_PUBLISHABLE_KEY ?? '',
      })
    : null;

export function partPagesForBuild(env?: BuildEnv): Promise<PartPageEntry[]> {
  return catalogueFor(env)?.partPages() ?? Promise.resolve([]);
}

export function categoriesForBuild(env?: BuildEnv): Promise<Category[]> {
  return catalogueFor(env)?.categories() ?? Promise.resolve([]);
}

export function categoryPagesForBuild(
  env?: BuildEnv,
): Promise<CategoryPageEntry[]> {
  return catalogueFor(env)?.categoryPages() ?? Promise.resolve([]);
}
