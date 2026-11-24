import { z } from 'zod';
import { categorySchema } from './categories.ts';
import { partPageSchema } from './partPages.ts';
import { CATALOGUE_PAGES_PATH } from './partPageView.ts';
import { siteFitmentSchema } from './fitment.ts';
import { vehicleSchema } from './vehicle.ts';

export const seriesPagePath = (make: string, series: string): string =>
  `${CATALOGUE_PAGES_PATH}/series/${encodeURIComponent(make)}/${encodeURIComponent(series)}`;

export const seriesCategoryPagePath = (
  make: string,
  series: string,
  category: string,
): string => `${seriesPagePath(make, series)}/${encodeURIComponent(category)}`;

export const seriesPartPageSchema = partPageSchema.extend({
  slug: z.string().min(1),
});

export const seriesRefSchema =
  vehicleSchema.shape.model.shape.chassis.shape.series.extend({
    slug: z.string().min(1),
  });

export const seriesPageResponseSchema = z.object({
  series: seriesRefSchema,
  models: z.array(z.object({ vehicles: z.array(vehicleSchema) })),
  categories: z.array(categorySchema),
  popular: z.array(seriesPartPageSchema).default([]),
});

export const seriesCategoryPageResponseSchema = z.object({
  series: seriesRefSchema,
  category: categorySchema,
  parts: z.array(
    z.object({
      pages: z.array(seriesPartPageSchema),
      fits: z
        .array(siteFitmentSchema.extend({ vehicle: vehicleSchema }))
        .default([]),
    }),
  ),
});

export type SeriesPartPage = z.infer<typeof seriesPartPageSchema>;
export type SeriesPageResponse = z.infer<typeof seriesPageResponseSchema>;
export type SeriesCategoryPageResponse = z.infer<
  typeof seriesCategoryPageResponseSchema
>;
