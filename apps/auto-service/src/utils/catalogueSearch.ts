import {
  normalizePartNumber,
  vinSchema,
  type CarHit,
} from '@podbor/catalog-contract';
import type { Locale } from '@/i18n/config';
import { carName, vehicleVariant } from './carName';
import type { SearchOutcome } from './catalogue';
import { PathBuilder, vehiclePath } from './paths';

export type SearchIntent = { kind: 'vin'; vin: string } | { kind: 'query' };

export const searchIntent = (q: string): SearchIntent => {
  const vin = vinSchema.safeParse(q);
  return vin.success ? { kind: 'vin', vin: vin.data } : { kind: 'query' };
};

type PartResult = SearchOutcome['results'][number];

export const exactPart = (q: string, results: PartResult[]): string | null => {
  const wanted = normalizePartNumber(q);
  const matching = results.filter(
    ({ normalized_value }) => normalized_value === wanted,
  );
  return matching.length === 1 ? matching[0].slug : null;
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
