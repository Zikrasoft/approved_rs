import { z } from 'zod';
import { categorySchema } from './categories.ts';
import { CATALOGUE_PAGES_PATH, relatedPartPageSchema } from './partPageView.ts';

export const carMakePagePath = (make: string): string =>
  `${CATALOGUE_PAGES_PATH}/cars/${encodeURIComponent(make)}`;

export const carMakePageResponseSchema = z.object({
  hub: z.boolean().default(false),
  categories: z.array(categorySchema).default([]),
  showcase: z.array(relatedPartPageSchema).default([]),
});

export type CarMakePageResponse = z.infer<typeof carMakePageResponseSchema>;
