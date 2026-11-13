import type { Locale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { translated, vehicleName } from '@podbor/catalog-contract';

type NamedModel = {
  name: string;
  chassis: {
    code: string;
    series: {
      name: string;
      translations: Record<string, Record<string, string>> | null;
      make: { name: string };
    };
  };
};

const seriesIn = ({ chassis: { series } }: NamedModel, locale: Locale) =>
  translated(series, 'name', locale);

export const carName = (model: NamedModel, locale: Locale): string =>
  vehicleName(model, seriesIn(model, locale)).full;

type NamedSeries = {
  name: string;
  translations: Record<string, Record<string, string>> | null;
};

const asModel = (series: NamedSeries, make: { name: string }): NamedModel => ({
  name: '',
  chassis: { code: '', series: { ...series, make } },
});

export const seriesName = (
  series: NamedSeries,
  make: { name: string },
  locale: Locale,
): string => carName(asModel(series, make), locale);

const naturally = new Intl.Collator('en', { numeric: true }).compare;

type ModelEntry = { model: { name: string; chassis: { code: string } } };

export const byModelName = (a: ModelEntry, b: ModelEntry): number =>
  naturally(a.model.name, b.model.name) ||
  naturally(a.model.chassis.code, b.model.chassis.code);

type Variant = {
  engine: { code: string } | null;
  power_kw: number | null;
  year_from: number | null;
  year_to: number | null;
};

export function vehicleVariant(vehicle: Variant, locale: Locale): string {
  const copy = content(locale).partsCar.car;
  return [
    vehicle.engine?.code,
    vehicle.power_kw && `${vehicle.power_kw} ${copy.powerUnit}`,
    vehicle.year_from &&
      `${vehicle.year_from}–${vehicle.year_to ?? copy.yearsOngoing}`,
  ]
    .filter(Boolean)
    .join(', ');
}
