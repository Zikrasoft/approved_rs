import { z } from 'zod';

export const VISITOR_VIN_LOOKUPS_SHOWN = 3;

export const visitorVinLookupsPath = (visitorId: string): string =>
  `/hooks/visitors/${encodeURIComponent(visitorId)}/vin-lookups`;

const visitorVinLookupSchema = z.object({
  make: z.string().nullable().default(null),
  model: z.string().nullable().default(null),
  vin_last4: z.string().nullable().default(null),
  at: z.string(),
  vehicle: z.string().nullable().default(null),
});

export type VisitorVinLookup = z.infer<typeof visitorVinLookupSchema>;

export const visitorVinLookupsResponseSchema = z.object({
  lookups: z
    .array(z.unknown())
    .transform((rows) =>
      rows.flatMap((row) => visitorVinLookupSchema.safeParse(row).data ?? []),
    ),
});
