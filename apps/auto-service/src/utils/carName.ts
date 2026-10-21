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

export function carName({ name, chassis }: NamedModel, locale: Locale): string {
  const { series } = chassis;
  const seriesName =
    (locale !== 'ru' && series.translations?.[locale]) || series.name;
  return `${series.make.name} ${seriesName} ${chassis.code} ${name}`;
}

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
