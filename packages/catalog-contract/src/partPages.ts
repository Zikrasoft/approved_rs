import { z } from 'zod';

export const PART_IDENTIFIER_TYPES = [
  'oem',
  'manufacturer-number',
  'ean',
] as const;

export const BRAND_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const brandSchema = z.object({
  name: z.string(),
  slug: z.string().regex(BRAND_SLUG_PATTERN),
});

export const brandNumberSchema = z.object({
  id: z.string(),
  type: z.enum(PART_IDENTIFIER_TYPES),
  value: z.string(),
  normalized_value: z.string(),
  brand: brandSchema,
});

export const partPageSchema = brandNumberSchema.extend({
  part: z.object({ id: z.string(), name: z.string() }),
  equivalents: z.array(brandNumberSchema),
});

export const partPagesResponseSchema = z.object({
  pages: z.array(partPageSchema),
  count: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export type BrandNumber = z.infer<typeof brandNumberSchema>;
export type PartPage = z.infer<typeof partPageSchema>;
export type PartPagesResponse = z.infer<typeof partPagesResponseSchema>;
