import { z } from 'zod';
import { bestOffer } from './availability.ts';
import { ofKnownFieldTypes } from './attributes.ts';
import { categorySchema, type CategoryField } from './categories.ts';
import type { PartOffer } from './cart-wire.ts';
import { sluggedPartPageSchema, type PartDemand } from './partPages.ts';
import { makeSchema } from './makeList.ts';
import { CATALOGUE_PAGES_PATH } from './partPageView.ts';
import {
  describeFacet,
  searchFacetSchema,
  universalFacets,
  usefulFacets,
  type CatalogLocale,
  type SearchFacet,
} from './search.ts';
import { translationsSchema } from './translations.ts';

type FacetValue = SearchFacet['values'][number];

export const CATEGORY_PAGE_SIZE = 48;

export const categoryPageCount = (listed: number): number =>
  Math.max(1, Math.ceil(listed / CATEGORY_PAGE_SIZE));

export const POPULAR_BLOCK_MIN = 2;

export const POPULAR_BLOCK_SIZE = 6;

export const categoryPagePath = (slug: string, page = 1): string =>
  `${CATALOGUE_PAGES_PATH}/categories/${encodeURIComponent(slug)}?page=${page}`;

type Demanded = { demand: PartDemand | null; part?: { id: string } };

export function popularPicks<T extends Demanded>(pages: T[]): T[] {
  const seen = new Set<string>();
  const picks = pages
    .filter(({ demand }) => demand?.popular)
    .sort((a, b) => b.demand!.score - a.demand!.score)
    .filter(({ part }) => !part || (!seen.has(part.id) && seen.add(part.id)));
  return picks.length >= POPULAR_BLOCK_MIN
    ? picks.slice(0, POPULAR_BLOCK_SIZE)
    : [];
}

const tally = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count }));
};

const brandCounts = (brands: { slug: string; name: string }[]) => {
  const counts = new Map<string, FacetValue>();
  for (const { slug, name } of brands) {
    const known = counts.get(slug);
    if (known) known.count += 1;
    else counts.set(slug, { value: slug, label: name, count: 1 });
  }
  return [...counts.values()];
};

export function categoryFacets(
  fields: CategoryField[],
  items: {
    brand: { slug: string; name: string };
    offers: PartOffer[];
    attributes: Record<string, unknown>;
  }[],
  locale: CatalogLocale,
): SearchFacet[] {
  const best = items.flatMap(({ offers }) => bestOffer(offers) ?? []);
  const prices = best.map(({ price }) => price);
  const universal = universalFacets({
    brands: brandCounts(items.map(({ brand }) => brand)),
    inStock: best.filter(({ stock_quantity }) => stock_quantity > 0).length,
    price: prices.length
      ? {
          min: Math.min(...prices),
          max: Math.max(...prices),
          count: prices.length,
        }
      : null,
    currency: best[0]?.currency ?? '',
  });
  const own = fields
    .filter(({ facet }) => facet)
    .map((field) =>
      describeFacet(
        field,
        tally(
          items.flatMap(({ attributes }) =>
            [attributes[field.key] ?? []].flat().map(String),
          ),
        ),
        locale,
      ),
    );
  return usefulFacets([...universal, ...own], items.length, []);
}

export const categoryCarSchema = z.object({
  make: makeSchema,
  series: z.array(
    z.object({
      slug: z.string().min(1),
      name: z.string(),
      translations: translationsSchema,
    }),
  ),
});

export const categoryPageResponseSchema = z.object({
  category: categorySchema,
  page: z.number().int().positive(),
  pages: z.number().int().positive(),
  count: z.number().int().nonnegative(),
  entries: z.array(sluggedPartPageSchema),
  popular: z.array(sluggedPartPageSchema).default([]),
  facets: ofKnownFieldTypes(searchFacetSchema).default([]),
  ranges: z
    .array(z.object({ key: z.string(), min: z.number(), max: z.number() }))
    .default([]),
  uniform: z.array(z.string()).default([]),
  demanded: z.boolean().default(false),
  cars: z.array(categoryCarSchema).default([]),
});

export type CategoryCarView = z.infer<typeof categoryCarSchema>;
export type CategoryPageResponse = z.infer<typeof categoryPageResponseSchema>;
