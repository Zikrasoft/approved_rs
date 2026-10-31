import type { Locale } from '@/i18n/config';
import { content } from '@/i18n/content';

type NamedModel = {
  name: string;
  chassis: {
    code: string;
    series: {
      name: string;
      translations: { sr?: string; en?: string } | null;
      make: { name: string };
    };
  };
};

const joined = (words: string[]): string =>
  words
    .filter(Boolean)
    .filter((word, index, all) => !all[index + 1]?.startsWith(`${word} `))
    .join(' ');

export function modelName(
  { name, chassis }: NamedModel,
  locale: Locale,
): string {
  const { series, code } = chassis;
  const seriesName =
    (locale !== 'ru' && series.translations?.[locale]) || series.name;
  return joined([
    seriesName,
    code === series.name || name.includes(code) ? '' : code,
    name,
  ]);
}

export function carName(model: NamedModel, locale: Locale): string {
  return joined([model.chassis.series.make.name, modelName(model, locale)]);
}

const naturally = new Intl.Collator('en', { numeric: true }).compare;

type ModelEntry = { model: { name: string; chassis: { code: string } } };

export const byModelName = (a: ModelEntry, b: ModelEntry): number =>
  naturally(a.model.name, b.model.name) ||
  naturally(a.model.chassis.code, b.model.chassis.code);

type Variant = {
  engine: { code: string };
  power_kw: number | null;
  year_from: number | null;
  year_to: number | null;
};

export function vehicleVariant(vehicle: Variant, locale: Locale): string {
  const copy = content(locale).partsCar.car;
  return [
    vehicle.engine.code,
    vehicle.power_kw && `${vehicle.power_kw} ${copy.powerUnit}`,
    vehicle.year_from &&
      `${vehicle.year_from}–${vehicle.year_to ?? copy.yearsOngoing}`,
  ]
    .filter(Boolean)
    .join(', ');
}
