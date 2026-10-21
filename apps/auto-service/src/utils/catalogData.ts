import {
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  type Vehicle,
  type VinFacts,
} from '@podbor/catalog-contract';
import type { z } from 'zod';

export type { Vehicle, VinFacts };

export type VinOutcome =
  | { kind: 'vehicle'; vehicle: Vehicle; facts: VinFacts }
  | { kind: 'inquiry'; vin: string };

type CatalogConfig = {
  backendUrl: string;
  publishableKey: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 8000;

export function createCatalogData({
  backendUrl,
  publishableKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetch: request = fetch,
}: CatalogConfig) {
  const call = async <T extends z.ZodType>(
    path: string,
    schema: T,
    init: RequestInit = {},
  ): Promise<z.infer<T> | null> => {
    if (!backendUrl) return null;
    try {
      const response = await request(`${backendUrl}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-publishable-api-key': publishableKey,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return null;
      const body = schema.safeParse(await response.json());
      return body.success ? body.data : null;
    } catch {
      return null;
    }
  };

  return {
    async vehicles(): Promise<Vehicle[]> {
      return (
        (await call('/store/vehicles', vehiclesResponseSchema))?.vehicles ?? []
      );
    },

    async resolveVin(vin: string): Promise<VinOutcome> {
      const lookup = await call('/store/vin-lookups', vinLookupResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ vin }),
      });
      return lookup?.resolved
        ? { kind: 'vehicle', vehicle: lookup.vehicle, facts: lookup.facts }
        : { kind: 'inquiry', vin };
    },
  };
}

export const catalogData = createCatalogData({
  backendUrl: import.meta.env.MEDUSA_BACKEND_URL ?? '',
  publishableKey: import.meta.env.MEDUSA_PUBLISHABLE_KEY ?? '',
});
