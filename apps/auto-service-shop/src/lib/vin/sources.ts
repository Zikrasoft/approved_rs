export const VIN_LOOKUP_SOURCES = [
  'storefront',
  'workshop-quote',
  'admin',
] as const;

export type VinLookupSource = (typeof VIN_LOOKUP_SOURCES)[number];

export type LookupOrigin =
  | { source: 'storefront'; bot: boolean | null; visitor_id: string | null }
  | { source: Exclude<VinLookupSource, 'storefront'> };

export type SourceCounts = Record<VinLookupSource, number>;
