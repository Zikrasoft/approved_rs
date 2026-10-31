import {
  normalizePartNumber,
  partNumberQuery,
  vinSchema,
  type CarHit,
  type VinFacts,
} from '@podbor/catalog-contract';
import type { Locale } from '@/i18n/config';
import { carName, vehicleVariant } from './carName';
import type { SearchOutcome } from './catalogue';
import { carFactsQuery } from './carFacts';
import { PathBuilder, vehiclePath } from './paths';

export type SearchIntent = { kind: 'vin'; vin: string } | { kind: 'query' };

export const searchIntent = (q: string): SearchIntent => {
  const vin = vinSchema.safeParse(q);
  return vin.success ? { kind: 'vin', vin: vin.data } : { kind: 'query' };
};

export const nearVin = (q: string): boolean => {
  const compact = q.replace(/[\s.-]+/g, '').toUpperCase();
  return (
    /^[A-Z0-9]{16,18}$/.test(compact) &&
    /[A-Z]/.test(compact) &&
    /\d/.test(compact)
  );
};

type ResolvedVin =
  | { kind: 'vehicle'; facts: VinFacts; place: CarHit | null }
  | { kind: 'inquiry'; place: CarHit | null };

export const vinDestination = (
  outcome: ResolvedVin,
  vin: string,
  locale: Locale,
): string | null => {
  const { place } = outcome;
  if (!place || place.kind === 'make') {
    return null;
  }
  const { href } = carLink(place, locale);
  return place.kind === 'vehicle' && outcome.kind === 'vehicle'
    ? `${href}${carFactsQuery(outcome.facts, vin)}`
    : href;
};

type PartResult = SearchOutcome['results'][number];

export const exactPart = (q: string, results: PartResult[]): string | null => {
  const wanted = normalizePartNumber(q);
  const matching = results.filter(
    ({ normalized_value }) => normalized_value === wanted,
  );
  return matching.length === 1 ? matching[0].slug : null;
};

const LETTER_LED_NUMBER = /^\p{L}{2}\d{2,}\p{L}?$/u;

const letterLedNumber = (q: string): string | null => {
  const number = normalizePartNumber(q);
  return LETTER_LED_NUMBER.test(number) ? number : null;
};

export const missingNumber = (q: string, results: PartResult[]): boolean => {
  const wanted = partNumberQuery(q) ?? letterLedNumber(q);
  return (
    wanted !== null &&
    !results.some(({ normalized_value }) => normalized_value === wanted)
  );
};

export type SearchLink = { href: string; label: string; detail?: string };

export const carLink = (
  { kind, make, model, vehicle }: CarHit,
  locale: Locale,
): SearchLink => {
  if (!model) {
    return { href: PathBuilder.partsMake(locale, make.slug), label: make.name };
  }
  const label = carName(model, locale);
  if (kind === 'model' || !vehicle) {
    return {
      href: PathBuilder.partsModel(locale, make.slug, model.slug),
      label,
    };
  }
  return {
    href: vehiclePath(locale, { ...vehicle, model }),
    label,
    detail: vehicleVariant(vehicle, locale),
  };
};

export type PartLink = SearchLink & { detail: string; thumb: string | null };

export type Suggestions = { cars: SearchLink[]; parts: PartLink[] };

export const suggestionsFrom = (
  { cars, results }: Pick<SearchOutcome, 'cars' | 'results'>,
  locale: Locale,
): Suggestions => ({
  cars: cars.map((car) => carLink(car, locale)),
  parts: results.map((result) => ({
    href: PathBuilder.partNumber(locale, result.slug),
    label: `${result.brand.name} ${result.value}`,
    detail: result.part.name,
    thumb: result.thumbnail,
  })),
});

type ListingScope = {
  locale: Locale;
  model: SearchOutcome['model'];
  modelName: string | null;
  category: SearchOutcome['category'];
  pages: SearchOutcome['scope_pages'];
  searchLabel: string;
};

export const listingCrumbs = ({
  locale,
  model,
  modelName,
  category,
  pages,
  searchLabel,
}: ListingScope): SearchLink[] => {
  const make = model?.chassis.series.make;
  const paged = model && pages?.model ? model : null;
  return [
    ...(make && pages?.make
      ? [{ href: PathBuilder.partsMake(locale, make.slug), label: make.name }]
      : []),
    ...(paged && modelName
      ? [
          {
            href: PathBuilder.partsModel(
              locale,
              paged.chassis.series.make.slug,
              paged.slug,
            ),
            label: modelName,
          },
        ]
      : []),
    category
      ? {
          href: paged
            ? PathBuilder.partsModelCategory(
                locale,
                paged.chassis.series.make.slug,
                paged.slug,
                category.slug,
              )
            : PathBuilder.partsCategory(locale, category.slug),
          label: category.name,
        }
      : { href: PathBuilder.partsSearch(locale), label: searchLabel },
  ];
};
