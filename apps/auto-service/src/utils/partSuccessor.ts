import { partPageSlug, type BrandNumber } from '@podbor/catalog-contract';
import { bestPrice } from './bestPrice';
import type { PartPageEntry } from './catalogue';

const slugOf = (number: BrandNumber) =>
  partPageSlug(number.brand.slug, number.normalized_value);

function buyability(page: PartPageEntry): [number, number] {
  const best = bestPrice([page]);
  if (!best) return [0, 0];
  return [best.inStock ? 2 : 1, -best.price];
}

const buyableFirst = (a: PartPageEntry, b: PartPageEntry) => {
  const [rankA, priceA] = buyability(a);
  const [rankB, priceB] = buyability(b);
  return rankB - rankA || priceB - priceA;
};

export function partSuccessor(
  page: PartPageEntry,
  bySlug: Map<string, PartPageEntry>,
): PartPageEntry | null {
  const replacement = page.part.replaced_by;
  if (replacement) {
    const named = bySlug.get(slugOf(replacement.brand_number));
    const numbers = [...bySlug.values()].filter(
      ({ part, superseded }) => part.id === replacement.id && !superseded,
    );
    return (
      [...(named ? [named] : []), ...numbers].sort(buyableFirst)[0] ?? null
    );
  }
  if (!page.superseded) {
    return null;
  }
  const current = page.equivalents
    .filter(({ superseded }) => !superseded)
    .sort(
      (a, b) =>
        Number(b.brand.slug === page.brand.slug) -
        Number(a.brand.slug === page.brand.slug),
    );
  return (
    current.map((number) => bySlug.get(slugOf(number))).find(Boolean) ?? null
  );
}
