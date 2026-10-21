import {
  partPageSlug,
  partPagesResponseSchema,
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  type PartPage,
  type Vehicle,
  type VinFacts,
} from '@podbor/catalog-contract';

export type { Vehicle, VinFacts };

export type VinOutcome =
  | { kind: 'vehicle'; vehicle: Vehicle; facts: VinFacts }
  | { kind: 'inquiry'; vin: string };

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
  const get = async (
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> => {
    const response = await fetch(`${backendUrl}${path}`, {
      ...init,
      headers: {
        'x-publishable-api-key': publishableKey,
        ...(init.body && { 'content-type': 'application/json' }),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Catalogue ${path} answered ${response.status}`);
    }
    return response.json();
  };

  return {
    async vehicles(): Promise<Vehicle[]> {
      return vehiclesResponseSchema.parse(await get('/store/vehicles'))
        .vehicles;
    },

    async resolveVin(vin: string): Promise<VinOutcome> {
      const lookup = await get('/store/vin-lookups', {
        method: 'POST',
        body: JSON.stringify({ vin }),
      })
        .then((body) => vinLookupResponseSchema.parse(body))
        .catch(() => null);
      return lookup?.resolved
        ? { kind: 'vehicle', vehicle: lookup.vehicle, facts: lookup.facts }
        : { kind: 'inquiry', vin };
    },

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

type CatalogueEnv = {
  MEDUSA_BACKEND_URL?: string;
  MEDUSA_PUBLISHABLE_KEY?: string;
};

export function catalogueFromEnv(env: CatalogueEnv) {
  return createCatalogue({
    backendUrl: env.MEDUSA_BACKEND_URL ?? '',
    publishableKey: env.MEDUSA_PUBLISHABLE_KEY ?? '',
  });
}

export function vehiclesForBuild(env: CatalogueEnv): Promise<Vehicle[]> {
  if (!env.MEDUSA_BACKEND_URL) {
    return Promise.resolve([]);
  }
  return catalogueFromEnv(env).vehicles();
}
