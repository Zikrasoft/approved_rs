import {
  normalizePartNumber,
  vinSchema,
  type CarHit,
  type VinFacts,
} from '@podbor/catalog-contract';
import type { Locale } from '@/i18n/config';
import { carName, vehicleVariant } from './carName';
import type { SearchOutcome } from './catalogue';
import { carFactsQuery } from './carFacts';
import { PathBuilder, vehiclePath, type VehicleAddress } from './paths';

export type SearchIntent = { kind: 'vin'; vin: string } | { kind: 'query' };

export const searchIntent = (q: string): SearchIntent => {
  const vin = vinSchema.safeParse(q);
  return vin.success ? { kind: 'vin', vin: vin.data } : { kind: 'query' };
};

type ResolvedVin =
  | {
      kind: 'vehicle';
      vehicle: VehicleAddress;
      facts: VinFacts;
      pages: { vehicle: boolean; model: boolean; make: boolean } | null;
    }
  | { kind: 'inquiry' };

export const vinDestination = (
  outcome: ResolvedVin,
  vin: string,
  locale: Locale,
): string | null => {
  if (outcome.kind !== 'vehicle' || !outcome.pages) return null;
  const { vehicle, facts, pages } = outcome;
  const make = vehicle.model.chassis.series.make.slug;
  if (pages.vehicle) {
    return `${vehiclePath(locale, vehicle)}${carFactsQuery(facts, vin)}`;
  }
  if (pages.model) {
    return PathBuilder.partsModel(locale, make, vehicle.model.slug);
  }
  return pages.make ? PathBuilder.partsMake(locale, make) : null;
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
  const modelPage = Boolean(model && make && pages?.model);
  return [
    ...(make && pages?.make
      ? [{ href: PathBuilder.partsMake(locale, make.slug), label: make.name }]
      : []),
    ...(model && make && modelName && modelPage
      ? [
          {
            href: PathBuilder.partsModel(locale, make.slug, model.slug),
            label: modelName,
          },
        ]
      : []),
    category
      ? {
          href:
            model && make && modelPage
              ? PathBuilder.partsModelCategory(
                  locale,
                  make.slug,
                  model.slug,
                  category.slug,
                )
              : PathBuilder.partsCategory(locale, category.slug),
          label: category.name,
        }
      : { href: PathBuilder.partsSearch(locale), label: searchLabel },
  ];
};
