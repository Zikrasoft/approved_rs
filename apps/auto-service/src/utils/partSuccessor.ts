import { partPageSlug, type BrandNumber } from '@podbor/catalog-contract';
import type { PartPageEntry } from './catalogue';

const slugOf = (number: BrandNumber) =>
  partPageSlug(number.brand.slug, number.normalized_value);

export function partSuccessor(
  page: PartPageEntry,
  bySlug: Map<string, PartPageEntry>,
): PartPageEntry | null {
  const replacement = page.part.replaced_by?.brand_number;
  if (replacement) {
    return bySlug.get(slugOf(replacement)) ?? null;
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
