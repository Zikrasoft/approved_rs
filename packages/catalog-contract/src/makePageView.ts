import { z } from 'zod';
import { CATALOGUE_PAGES_PATH } from './partPageView.ts';

export const MAKES_PAGE_PATH = `${CATALOGUE_PAGES_PATH}/makes`;

export const makePagePath = (slug: string): string =>
  `${MAKES_PAGE_PATH}/${encodeURIComponent(slug)}`;

const makeSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

export const makesPageResponseSchema = z.object({
  makes: z.array(makeSchema),
});

export const makePageResponseSchema = z.object({
  make: makeSchema,
  series: z.array(
    z.object({
      slug: z.string().min(1),
      name: z.string().min(1),
      categories: z.array(z.string()),
    }),
  ),
});

export type MakesPageResponse = z.infer<typeof makesPageResponseSchema>;
export type MakePageResponse = z.infer<typeof makePageResponseSchema>;
