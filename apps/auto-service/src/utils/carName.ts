import type { Locale } from '@/i18n/config';

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
