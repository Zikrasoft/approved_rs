import type { BrandNumber } from '@podbor/catalog-contract';

type Numbered = Pick<BrandNumber, 'type' | 'superseded'>;

export function splitNumbers<T extends Numbered>(
  numbers: T[],
  first?: T,
): { current: T[]; previous: T[] } {
  const rank = (number: T) =>
    number === first ? 2 : Number(number.type === 'oem');
  const oemFirst = [...numbers].sort((a, b) => rank(b) - rank(a));
  return {
    current: oemFirst.filter(({ superseded }) => !superseded),
    previous: oemFirst.filter(({ superseded }) => superseded),
  };
}

export function currentNumber<
  T extends Pick<BrandNumber, 'superseded'> & {
    brand: { slug: string };
    part: { id: string };
  },
>(number: T, candidates: T[]): T | undefined {
  const sameBrand = (candidate: T) =>
    Number(candidate.brand.slug === number.brand.slug);
  return candidates
    .filter(
      (candidate) =>
        candidate.part.id === number.part.id && !candidate.superseded,
    )
    .sort((a, b) => sameBrand(b) - sameBrand(a))[0];
}
