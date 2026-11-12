import { visitorIdSchema } from './form.ts';
import { logError } from './logError.ts';
import {
  visitorVinLookupsPath,
  visitorVinLookupsResponseSchema,
  type VisitorVinLookup,
} from './visitorSearchesWire.ts';

const SHOP_TIMEOUT_MS = 3_000;

export type VisitorSearches = (
  visitorId: string | null | undefined,
) => Promise<VisitorVinLookup[]>;

export const noVisitorSearches: VisitorSearches = async () => [];

export function createVisitorSearches({
  shopUrl,
  secret,
}: {
  shopUrl?: string;
  secret?: string;
}): VisitorSearches {
  if (!shopUrl || !secret) return noVisitorSearches;
  return async (visitorId) => {
    const visitor = visitorIdSchema.parse(visitorId ?? null);
    if (!visitor) return [];
    try {
      const response = await fetch(
        new URL(visitorVinLookupsPath(visitor), shopUrl),
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(SHOP_TIMEOUT_MS),
        },
      );
      if (!response.ok) throw new Error(`The shop answered ${response.status}`);
      return visitorVinLookupsResponseSchema.parse(await response.json())
        .lookups;
    } catch (error) {
      logError('[lead-crm] the shop gave no VIN searches for a Lead', error);
      return [];
    }
  };
}
