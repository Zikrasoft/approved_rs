import { z } from 'zod';
import { CATEGORY_FIELD_TYPES } from './attributes.ts';
import { imageSchema } from './images.ts';
import { BRAND_SLUG_PATTERN } from './partPages.ts';
import { translationsSchema } from './translations.ts';

export {
  CATALOG_TRANSLATION_LOCALES,
  localizedUnit,
  translated,
  translationsSchema,
} from './translations.ts';

export const CATALOG_KEY_PATTERN = BRAND_SLUG_PATTERN;

const catalogKey = z.string().regex(CATALOG_KEY_PATTERN);

export const categoryFieldOptionSchema = z.object({
  key: catalogKey,
  label: z.string(),
  translations: translationsSchema,
  rank: z.number(),
});

export const categoryFieldSchema = z.object({
  key: catalogKey,
  type: z.enum(CATEGORY_FIELD_TYPES),
  unit: z.string().nullable(),
  label: z.string(),
  translations: translationsSchema,
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
  translations: translationsSchema,
  maintenance_kit: z.boolean(),
  kit_rank: z.number(),
  service_label: z.string().nullable(),
  service_price: z.number().int().nonnegative().nullable(),
  service_note: z.string().nullable(),
  installation_price: z.number().int().nonnegative().nullable().default(null),
  image: imageSchema.nullable(),
  fields: z.array(categoryFieldSchema),
});

export const categoriesResponseSchema = z.object({
  categories: z.array(categorySchema),
});

export type CategoryField = z.infer<typeof categoryFieldSchema>;
export type Category = z.infer<typeof categorySchema>;
