import { z } from 'zod';
import { makeListSchema } from './makeList.ts';

const named = z.object({ slug: z.string().min(1), name: z.string().min(1) });

export const cataloguePageListSchema = z.object({
  parts: z.array(z.object({ slug: z.string().min(1), indexable: z.boolean() })),
  makes: z.array(
    named.extend({
      hub: z.boolean(),
      parts: z.number().int().nonnegative().nullable().default(null),
    }),
  ),
  series: z.array(
    named.extend({
      make: z.string().min(1),
      categories: z.array(z.string().min(1)),
    }),
  ),
  categories: z.array(
    named.extend({
      listed: z.number().int().nonnegative().nullable().default(null),
      demand: z.number().int().nonnegative().nullable().default(null),
    }),
  ),
  catalogue_makes: makeListSchema.nullable().default(null),
});

export type CataloguePageList = z.infer<typeof cataloguePageListSchema>;
