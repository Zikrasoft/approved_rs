import {
  normalizePartNumber,
  partNumberQuery,
  type CarHit,
  type Vehicle,
} from '@podbor/catalog-contract';
import { vinOf, vinText } from '@podbor/lead-crm/vin';
import type { Locale } from '@/i18n/config';
import { carName, seriesName, vehicleVariant } from './carName';
import type { SearchOutcome } from './catalogue';
import { VIN_PARAM } from './carFacts';
import { PathBuilder, seriesPath } from './paths';

export type SearchIntent = { kind: 'vin'; vin: string } | { kind: 'query' };

export const searchIntent = (q: string): SearchIntent => {
  const vin = vinOf(q);
  return vin ? { kind: 'vin', vin } : { kind: 'query' };
};

export const nearVin = (q: string): boolean => {
  const compact = vinText(q);
  return (
    /^[A-Z0-9]{16,18}$/.test(compact) &&
    /[A-Z]/.test(compact) &&
    /\d/.test(compact)
  );
};

type ResolvedVin =
  | {
      kind: 'vehicle';
      vehicle: Pick<Vehicle, 'model'>;
      place: CarHit | null;
    }
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
  if (outcome.kind === 'inquiry') {
    return carLink(place, locale).href;
  }
  const { model } = outcome.vehicle;
  return `${PathBuilder.partsModelSearch(
    locale,
    model.chassis.series.make.slug,
    model.slug,
  )}&${new URLSearchParams({ [VIN_PARAM]: vin })}`;
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
  return number && LETTER_LED_NUMBER.test(number) ? number : null;
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
  { make, series, model, vehicle }: CarHit,
  locale: Locale,
): SearchLink => {
  if (series) {
    return {
      href: seriesPath(locale, { name: series.name, make }),
      label: seriesName(series, make, locale),
    };
  }
  if (!model) {
    return { href: PathBuilder.partsMake(locale, make.slug), label: make.name };
  }
  return {
    href: PathBuilder.partsModelSearch(locale, make.slug, model.slug),
    label: carName(model, locale),
    ...(vehicle && { detail: vehicleVariant(vehicle, locale) }),
  };
};

export type PartLink = SearchLink & {
  detail: string;
  thumb: string | null;
  slug: string;
};

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
    slug: result.slug,
  })),
});

type ListingScope = {
  locale: Locale;
  model: SearchOutcome['model'];
  category: SearchOutcome['category'];
  pages: SearchOutcome['scope_pages'];
  searchLabel: string;
};

export const listingCrumbs = ({
  locale,
  model,
  category,
  pages,
  searchLabel,
}: ListingScope): SearchLink[] => {
  const series = model?.chassis.series;
  return [
    ...(series && pages?.make
      ? [
          {
            href: PathBuilder.partsMake(locale, series.make.slug),
            label: series.make.name,
          },
        ]
      : []),
    ...(series && pages?.series
      ? [
          {
            href: seriesPath(locale, series),
            label: seriesName(series, series.make, locale),
          },
        ]
      : []),
    category
      ? {
          href: PathBuilder.partsCategory(locale, category.slug),
          label: category.name,
        }
      : { href: PathBuilder.partsSearch(locale), label: searchLabel },
  ];
};

export const inquiryTopic = ({
  model,
  category,
  query,
  filters,
}: {
  model?: string | null;
  category?: string | null;
  query?: string;
  filters: string[];
}): string => [query, model, category, ...filters].filter(Boolean).join(', ');
