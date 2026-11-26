import { z } from 'zod';
import { makeListSchema, makeSchema } from './makeList.ts';

export const cataloguePageListSchema = z.object({
  parts: z.array(z.object({ slug: z.string().min(1), indexable: z.boolean() })),
  makes: z.array(
    makeSchema.extend({
      hub: z.boolean(),
      parts: z.number().int().nonnegative().nullable().default(null),
    }),
  ),
  series: z.array(
    makeSchema.extend({
      make: z.string().min(1),
      categories: z.array(z.string().min(1)),
      listed: z
        .record(z.string(), z.number().int().nonnegative())
        .nullable()
        .default(null),
    }),
  ),
  categories: z.array(
    makeSchema.extend({
      listed: z.number().int().nonnegative().nullable().default(null),
      demand: z.number().int().nonnegative().nullable().default(null),
    }),
  ),
  catalogue_makes: makeListSchema.nullable().default(null),
});

export const cataloguePartsHubSchema = cataloguePageListSchema.pick({
  makes: true,
  categories: true,
});

export type CataloguePageList = z.infer<typeof cataloguePageListSchema>;

export type CataloguePartsHub = z.infer<typeof cataloguePartsHubSchema>;
