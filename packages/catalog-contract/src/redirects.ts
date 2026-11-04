import { z } from 'zod';

export const RESERVED_PARTS_SEGMENTS = [
  'c',
  'p',
  'car',
  'cart',
  'search',
  'prices',
  'makes',
] as const;

const slug = z.string().nullable().default(null);

export const cataloguePlaceSchema = z.object({
  brand: slug,
  make: slug,
  model: slug,
  vehicle: slug,
  category: slug,
  part: slug,
});

export type CataloguePlace = z.infer<typeof cataloguePlaceSchema>;

export const catalogueRedirectSchema = z.object({
  from: cataloguePlaceSchema,
  to: cataloguePlaceSchema,
});

export type CatalogueRedirect = z.infer<typeof catalogueRedirectSchema>;

export const catalogueRedirectsResponseSchema = z.object({
  redirects: z.array(catalogueRedirectSchema),
});
