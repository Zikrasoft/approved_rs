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

export const CATALOGUE_TIMEOUT_MS = 10_000;
const PART_PAGES_BATCH = 1000;

export type PartPageEntry = PartPage & { slug: string; indexable: boolean };

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

  return {
    async partPages(): Promise<PartPageEntry[]> {
      const bySlug = new Map<string, PartPageEntry>();
      for (let offset = 0; ;) {
        const { pages, count } = partPagesResponseSchema.parse(
          await request(
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

export async function partPagesForBuild(
  env: CatalogueEnv,
): Promise<PartPageEntry[]> {
  return (await catalogueFromEnv(env)?.partPages()) ?? [];
}

export async function vehiclesForBuild(env: CatalogueEnv): Promise<Vehicle[]> {
  return (await catalogueFromEnv(env)?.vehicles()) ?? [];
}
