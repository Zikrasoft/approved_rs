import { partPageSlug, type BrandNumber } from '@podbor/catalog-contract';
import {
  bestOffer,
  compareOffers,
} from '@podbor/catalog-contract/availability';
import type { PartPageEntry } from './catalogueSnapshot';

const slugOf = (number: BrandNumber) =>
  partPageSlug(number.brand.slug, number.normalized_value);

const pricedPage = (pages: PartPageEntry[]) => {
  const offer = bestOffer(pages.flatMap(({ offers }) => offers));
  return pages.find(({ offers }) => offer && offers.includes(offer)) ?? null;
};

const pageWithBestOffer = (pages: PartPageEntry[]) =>
  pricedPage(pages) ?? pages[0] ?? null;

export const pricedEquivalent = (
  page: PartPageEntry,
  bySlug: Map<string, PartPageEntry>,
): PartPageEntry | null =>
  pricedPage(
    page.equivalents
      .filter(({ superseded }) => !superseded)
      .flatMap((number) => bySlug.get(slugOf(number)) ?? []),
  );

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
    return pageWithBestOffer([...(named ? [named] : []), ...numbers]);
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
  return pageWithBestOffer(
    current.flatMap((number) => bySlug.get(slugOf(number)) ?? []),
  );
}

export function currentNumbers(
  page: PartPageEntry,
  bySlug: Map<string, PartPageEntry>,
): (BrandNumber & { slug: string })[] {
  const replacement = page.part.replaced_by;
  const candidates: BrandNumber[] = replacement
    ? [
        replacement.brand_number,
        ...[...bySlug.values()].filter(
          ({ part }) => part.id === replacement.id,
        ),
      ]
    : page.superseded
      ? page.equivalents
      : [];
  const unique = new Map(
    candidates
      .filter(({ superseded }) => !superseded)
      .map((number) => [slugOf(number), { ...number, slug: slugOf(number) }]),
  );
  const best = (number: BrandNumber & { slug: string }) =>
    bestOffer(bySlug.get(number.slug)?.offers ?? []);
  const byOffer = (
    a: BrandNumber & { slug: string },
    b: BrandNumber & { slug: string },
  ) => {
    const [offerA, offerB] = [best(a), best(b)];
    if (offerA && offerB) return compareOffers(offerA, offerB);
    return Number(Boolean(offerB)) - Number(Boolean(offerA));
  };
  const rank = (number: BrandNumber & { slug: string }) =>
    (number.type === 'oem' ? 0 : 2) +
    Number(number.brand.slug !== page.brand.slug);
  return [...unique.values()].sort(
    (a, b) => byOffer(a, b) || rank(a) - rank(b),
  );
}
