import { z } from 'zod';

export const CATALOG_TRANSLATION_LOCALES = ['sr', 'en'] as const;

const columns = z.record(z.string(), z.string()).optional();

export const translationsSchema = z
  .object({ sr: columns, en: columns } satisfies Record<
    (typeof CATALOG_TRANSLATION_LOCALES)[number],
    typeof columns
  >)
  .nullable();

type Translated<Column extends string> = Record<Column, string> & {
  translations: z.infer<typeof translationsSchema>;
};

export const translated = <Column extends string>(
  row: Translated<Column>,
  column: Column,
  locale: string,
): string =>
  row.translations?.[locale as (typeof CATALOG_TRANSLATION_LOCALES)[number]]?.[
    column
  ] || row[column];

const LATIN_UNITS: Record<string, string> = {
  'А·ч': 'Ah',
  'А*ч': 'Ah',
  Ач: 'Ah',
  А: 'A',
  В: 'V',
  Вт: 'W',
  кВт: 'kW',
  мм: 'mm',
  см: 'cm',
  м: 'm',
  л: 'l',
  мл: 'ml',
  кг: 'kg',
  г: 'g',
  Нм: 'Nm',
  'Н·м': 'Nm',
};

export const localizedUnit = (
  unit: string | null,
  locale: string,
): string | null =>
  unit && locale !== 'ru' ? (LATIN_UNITS[unit.trim()] ?? unit) : unit;
