import {
  partPageSlug,
  partPagesResponseSchema,
  type PartPage,
} from '@podbor/catalog-contract';

export const CATALOGUE_TIMEOUT_MS = 10_000;
const PART_PAGES_BATCH = 1000;

export type PartPageEntry = PartPage & { slug: string; indexable: boolean };

export type CatalogueConfig = {
  backendUrl: string;
  publishableKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
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

  return {
    async partPages(): Promise<PartPageEntry[]> {
      const bySlug = new Map<string, PartPageEntry>();
      for (let offset = 0; ;) {
        const { pages, count } = partPagesResponseSchema.parse(
          await get(
            `/store/part-pages?offset=${offset}&limit=${PART_PAGES_BATCH}`,
          ),
        );
        for (const page of pages) {
          const slug = partPageSlug(page.brand.slug, page.normalized_value);
          if (!bySlug.has(slug)) {
            bySlug.set(slug, { ...page, slug, indexable: false });
          }
        }
        offset += pages.length;
        if (pages.length === 0 || offset >= count) {
          return [...bySlug.values()];
        }
      }
    },
  };
}

export function partPagesForBuild(env: {
  MEDUSA_BACKEND_URL?: string;
  MEDUSA_PUBLISHABLE_KEY?: string;
}): Promise<PartPageEntry[]> {
  if (!env.MEDUSA_BACKEND_URL) {
    return Promise.resolve([]);
  }
  return createCatalogue({
    backendUrl: env.MEDUSA_BACKEND_URL,
    publishableKey: env.MEDUSA_PUBLISHABLE_KEY ?? '',
  }).partPages();
}
