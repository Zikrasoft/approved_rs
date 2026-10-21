import { z } from 'zod';

export const CATALOG_TRANSLATION_LOCALES = ['sr', 'en'] as const;

export const translationsSchema = z
  .partialRecord(
    z.enum(CATALOG_TRANSLATION_LOCALES),
    z.record(z.string(), z.string()),
  )
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
