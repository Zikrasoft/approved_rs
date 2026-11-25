import { z } from 'zod';
import { categorySchema } from './categories.ts';
import { sluggedPartPageSchema } from './partPages.ts';
import { CATALOG_LOCALES } from './search.ts';
import { siteFitmentSchema } from './fitment.ts';
import { vehicleSchema } from './vehicle.ts';

export const CATALOGUE_LOCALE_HEADER = 'x-catalogue-locale';

export const catalogueLocaleSchema = z.enum(CATALOG_LOCALES).catch('ru');

export const CATALOGUE_PAGES_PATH = '/store/catalogue-pages';

export const partPagePath = (slug: string): string =>
  `${CATALOGUE_PAGES_PATH}/parts/${encodeURIComponent(slug)}`;

const vehicleIds = z.array(z.string()).default([]);

export const relatedPartPageSchema = sluggedPartPageSchema.extend({
  category: categorySchema.nullable(),
});

export const partPageViewSchema = relatedPartPageSchema.extend({
  indexable: z.boolean(),
  fits: z.array(siteFitmentSchema),
  requirement_cars: vehicleIds,
  kit_cars: vehicleIds,
});

export const linkedSeriesSchema = z.object({
  make: z.string().min(1),
  slug: z.string().min(1),
});

export const partPageResponseSchema = z.object({
  page: partPageViewSchema,
  related: z.array(relatedPartPageSchema),
  vehicles: z.array(vehicleSchema).default([]),
  linked_series: z.array(linkedSeriesSchema).default([]),
});

export type RelatedPartPage = z.infer<typeof relatedPartPageSchema>;
export type PartPageView = z.infer<typeof partPageViewSchema>;
export type LinkedSeries = z.infer<typeof linkedSeriesSchema>;
export type PartPageResponse = z.infer<typeof partPageResponseSchema>;
