import { z } from 'zod';
import { displayEnum } from './displayEnum.ts';
import { attributeValuesSchema } from './attributes.ts';
import { imageSchema } from './images.ts';
import { translationsSchema } from './translations.ts';
import { partOfferSchema } from './cart-wire.ts';
import { pageFields } from './page.ts';

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
  type: displayEnum(PART_IDENTIFIER_TYPES),
  value: z.string(),
  normalized_value: z.string(),
  superseded: z.boolean(),
  brand: brandSchema,
});

export const picturedBrandNumberSchema = brandNumberSchema.extend({
  images: z.array(imageSchema),
});

export const STAGED_DATA_KINDS = [
  'cross_references',
  'applicability',
  'images',
] as const;

export const crossReferenceSchema = z.object({
  brand: z.string(),
  number: z.string(),
});

export const supplierDataSchema = z.object({
  cross_references: z.array(crossReferenceSchema),
  applicability: z.array(z.string()),
  images: z.array(z.url()),
});

export const partPageSchema = picturedBrandNumberSchema.extend({
  part: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().default(null),
    translations: translationsSchema,
    replaced_by: z
      .object({
        id: z.string(),
        name: z.string(),
        translations: translationsSchema,
        brand_number: brandNumberSchema,
      })
      .nullable(),
    category_id: z.string().nullable(),
    attributes: attributeValuesSchema,
    installation_price: z.number().int().nonnegative().nullable().default(null),
  }),
  equivalents: z.array(picturedBrandNumberSchema),
  offers: z.array(partOfferSchema),
  supplier_data: supplierDataSchema,
});

export const partPagesResponseSchema = z.object({
  pages: z.array(partPageSchema),
  ...pageFields,
});

export type BrandNumber = z.infer<typeof brandNumberSchema>;
export type PicturedBrandNumber = z.infer<typeof picturedBrandNumberSchema>;
export type StagedDataKind = (typeof STAGED_DATA_KINDS)[number];
export type SupplierData = z.infer<typeof supplierDataSchema>;
export type PartPage = z.infer<typeof partPageSchema>;
export type PartPagesResponse = z.infer<typeof partPagesResponseSchema>;
