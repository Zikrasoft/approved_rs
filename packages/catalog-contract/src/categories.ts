import { z } from 'zod';
import { CATEGORY_FIELD_TYPES } from './attributes.ts';
import { BRAND_SLUG_PATTERN } from './partPages.ts';

export const CATALOG_KEY_PATTERN = BRAND_SLUG_PATTERN;

export const CATALOG_TRANSLATION_LOCALES = ['sr', 'en'] as const;

export const catalogTranslationsSchema = z
  .partialRecord(
    z.enum(CATALOG_TRANSLATION_LOCALES),
    z.record(z.string(), z.string()),
  )
  .nullable();

const catalogKey = z.string().regex(CATALOG_KEY_PATTERN);

export const categoryFieldOptionSchema = z.object({
  key: catalogKey,
  label: z.string(),
  translations: catalogTranslationsSchema,
  rank: z.number(),
});

export const categoryFieldSchema = z.object({
  key: catalogKey,
  type: z.enum(CATEGORY_FIELD_TYPES),
  unit: z.string().nullable(),
  label: z.string(),
  translations: catalogTranslationsSchema,
  required: z.boolean(),
  facet: z.boolean(),
  rank: z.number(),
  options: z.array(categoryFieldOptionSchema),
});

export const categorySchema = z.object({
  id: z.string(),
  slug: catalogKey,
  name: z.string(),
  text: z.string(),
  translations: catalogTranslationsSchema,
  fields: z.array(categoryFieldSchema),
});

export const categoriesResponseSchema = z.object({
  categories: z.array(categorySchema),
});

export type CategoryField = z.infer<typeof categoryFieldSchema>;
export type Category = z.infer<typeof categorySchema>;

type Translated<Column extends string> = Record<Column, string> & {
  translations: z.infer<typeof catalogTranslationsSchema>;
};

export const translated = <Column extends string>(
  row: Translated<Column>,
  column: Column,
  locale: string,
): string =>
  row.translations?.[locale as (typeof CATALOG_TRANSLATION_LOCALES)[number]]?.[
    column
  ] || row[column];
