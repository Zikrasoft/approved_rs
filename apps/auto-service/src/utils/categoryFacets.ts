import {
  describeFacet,
  universalFacets,
  usefulFacets,
  type CatalogLocale,
  type SearchFacet,
} from '@podbor/catalog-contract';
import type { CategoryPageEntry } from './catalogueSnapshot';

const tally = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count }));
};

export function categoryFacets(
  category: CategoryPageEntry,
  locale: CatalogLocale,
): SearchFacet[] {
  const { pages } = category;
  const best = pages.flatMap(({ offers }) => offers.slice(0, 1));
  const prices = best.map(({ price }) => price);
  const brandName = new Map(pages.map(({ brand }) => [brand.slug, brand.name]));
  const universal = universalFacets({
    brands: tally(pages.map(({ brand }) => brand.slug)).map((value) => ({
      ...value,
      label: brandName.get(value.value) ?? value.value,
    })),
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
  const fields = category.fields
    .filter(({ facet }) => facet)
    .map((field) =>
      describeFacet(
        field,
        tally(
          pages.flatMap(({ part }) =>
            [part.attributes[field.key] ?? []].flat().map(String),
          ),
        ),
        locale,
      ),
    );
  return usefulFacets([...universal, ...fields], pages.length, []);
}
