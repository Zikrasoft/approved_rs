import { z } from '@medusajs/framework/zod';
import {
  BRAND_SLUG_PATTERN,
  CATALOG_KEY_PATTERN,
  CATEGORY_FIELD_TYPES,
  normalizePartNumber,
} from '@podbor/catalog-contract';

import { TARGET_LOCALES } from '../../lib/publish/translate';
import {
  FITMENT_GEARBOX_TYPES,
  FITMENT_STEERING_SIDES,
} from '../../modules/catalog/models/fitment';
import { PART_IDENTIFIER_TYPES } from '../../modules/catalog/models/part-identifier';

export const AdminSearchParts = z.object({
  q: z.string().trim().min(1),
});
export type AdminSearchPartsType = z.infer<typeof AdminSearchParts>;

const partNumber = z
  .string()
  .trim()
  .refine((value) => normalizePartNumber(value).length > 0);

export const AdminCreatePart = z.object({
  name: z.string().trim().min(1),
  identifiers: z
    .array(
      z.object({
        type: z.enum(PART_IDENTIFIER_TYPES),
        brand_id: z.string().min(1),
        value: partNumber,
      }),
    )
    .min(1),
  category_id: z.string().min(1).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
export type AdminCreatePartType = z.infer<typeof AdminCreatePart>;

export const AdminListFitments = z.object({
  vehicle_id: z.string().min(1).optional(),
  part_id: z.string().min(1).optional(),
});
export type AdminListFitmentsType = z.infer<typeof AdminListFitments>;

export const AdminCreateFitment = z.object({
  part_id: z.string().min(1),
  vehicle_id: z.string().min(1),
  production_from: z.coerce.date().nullable().optional(),
  production_to: z.coerce.date().nullable().optional(),
  steering: z.enum(FITMENT_STEERING_SIDES).nullable().optional(),
  gearbox: z.enum(FITMENT_GEARBOX_TYPES).nullable().optional(),
});
export type AdminCreateFitmentType = z.infer<typeof AdminCreateFitment>;

export const AdminUpdateSupplier = z.object({
  markup_percentage: z.number().min(0),
});
export type AdminUpdateSupplierType = z.infer<typeof AdminUpdateSupplier>;

export const AdminCreateBrand = z.strictObject({
  name: z.string().trim().min(1),
  slug: z.string().regex(BRAND_SLUG_PATTERN),
});
export type AdminCreateBrandType = z.infer<typeof AdminCreateBrand>;

export const AdminEditTranslation = z.strictObject({
  locale: z.enum(TARGET_LOCALES),
  fields: z.record(z.string(), z.string().trim().min(1)),
});
export type AdminEditTranslationType = z.infer<typeof AdminEditTranslation>;

export const AdminCreateBrandSpelling = z.strictObject({
  supplier_id: z.string().min(1),
  value: z.string().trim().min(1),
});
export type AdminCreateBrandSpellingType = z.infer<
  typeof AdminCreateBrandSpelling
>;

const catalogKey = z.string().regex(CATALOG_KEY_PATTERN);

const categoryColumns = {
  name: z.string().trim().min(1),
  text: z.string(),
};

export const AdminCreateCategory = z.strictObject({
  slug: catalogKey,
  ...categoryColumns,
  text: categoryColumns.text.default(''),
});
export type AdminCreateCategoryType = z.infer<typeof AdminCreateCategory>;

export const AdminUpdateCategory = z.strictObject(categoryColumns).partial();
export type AdminUpdateCategoryType = z.infer<typeof AdminUpdateCategory>;

const fieldColumns = {
  type: z.enum(CATEGORY_FIELD_TYPES),
  unit: z.string().trim().min(1).nullable(),
  label: z.string().trim().min(1),
  required: z.boolean(),
  facet: z.boolean(),
  rank: z.number().int(),
};

export const AdminCreateCategoryField = z.strictObject({
  key: catalogKey,
  ...fieldColumns,
  unit: fieldColumns.unit.default(null),
  required: fieldColumns.required.default(false),
  facet: fieldColumns.facet.default(false),
  rank: fieldColumns.rank.default(0),
});
export type AdminCreateCategoryFieldType = z.infer<
  typeof AdminCreateCategoryField
>;

export const AdminUpdateCategoryField = z.strictObject(fieldColumns).partial();
export type AdminUpdateCategoryFieldType = z.infer<
  typeof AdminUpdateCategoryField
>;

const optionColumns = {
  label: z.string().trim().min(1),
  rank: z.number().int(),
};

export const AdminCreateCategoryFieldOption = z.strictObject({
  key: catalogKey,
  ...optionColumns,
  rank: optionColumns.rank.default(0),
});
export type AdminCreateCategoryFieldOptionType = z.infer<
  typeof AdminCreateCategoryFieldOption
>;

export const AdminUpdateCategoryFieldOption = z
  .strictObject(optionColumns)
  .partial();
export type AdminUpdateCategoryFieldOptionType = z.infer<
  typeof AdminUpdateCategoryFieldOption
>;

export const AdminClassifyPart = z.strictObject({
  category_id: z.string().min(1).nullable(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});
export type AdminClassifyPartType = z.infer<typeof AdminClassifyPart>;
