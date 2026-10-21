import { z } from '@medusajs/framework/zod';
import {
  BRAND_SLUG_PATTERN,
  CATALOG_KEY_PATTERN,
  CATEGORY_FIELD_TYPES,
  FITMENT_AXLES,
  FITMENT_SIDES,
  GEARBOX_TYPES,
  normalizePartNumber,
  STAGED_DATA_KINDS,
  STEERING_SIDES,
} from '@podbor/catalog-contract';

import { TARGET_LOCALES } from '../../lib/publish/translate';
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

export const AdminUpdatePart = z.strictObject({
  name: z.string().trim().min(1).optional(),
  replaced_by_id: z.string().min(1).nullable().optional(),
  category_id: z.string().min(1).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
export type AdminUpdatePartType = z.infer<typeof AdminUpdatePart>;

export const AdminUpdatePartIdentifier = z.strictObject({
  superseded: z.boolean(),
});
export type AdminUpdatePartIdentifierType = z.infer<
  typeof AdminUpdatePartIdentifier
>;

export const AdminListFitments = z.object({
  vehicle_id: z.string().min(1).optional(),
  part_id: z.string().min(1).optional(),
});
export type AdminListFitmentsType = z.infer<typeof AdminListFitments>;

const fitmentConditions = {
  quantity: z.number().int().positive().optional(),
  axle: z.enum(FITMENT_AXLES).nullable().optional(),
  side: z.enum(FITMENT_SIDES).nullable().optional(),
  production_from: z.coerce.date().nullable().optional(),
  production_to: z.coerce.date().nullable().optional(),
  steering: z.enum(STEERING_SIDES).nullable().optional(),
  gearbox: z.enum(GEARBOX_TYPES).nullable().optional(),
  note: z
    .string()
    .trim()
    .transform((note) => note || null)
    .nullable()
    .optional(),
};

export const AdminCreateFitment = z.object({
  part_id: z.string().min(1),
  vehicle_id: z.string().min(1),
  ...fitmentConditions,
});
export type AdminCreateFitmentType = z.infer<typeof AdminCreateFitment>;

export const VEHICLE_FILTER_KEYS = [
  'vehicle_id',
  'make_id',
  'series_id',
  'chassis_id',
  'model_id',
  'engine_id',
  'engine_family',
  'year_from',
  'year_to',
] as const;

export const AdminBulkAttachFitments = z
  .object({
    part_id: z.string().min(1),
    vehicle_id: z.string().min(1).optional(),
    make_id: z.string().min(1).optional(),
    series_id: z.string().min(1).optional(),
    chassis_id: z.string().min(1).optional(),
    model_id: z.string().min(1).optional(),
    engine_id: z.string().min(1).optional(),
    engine_family: z.string().trim().min(1).optional(),
    year_from: z.number().int().optional(),
    year_to: z.number().int().optional(),
    ...fitmentConditions,
  })
  .refine(
    (body) => VEHICLE_FILTER_KEYS.some((key) => body[key] !== undefined),
    {
      message: 'Pick at least one Vehicle filter',
    },
  );
export type AdminBulkAttachFitmentsType = z.infer<
  typeof AdminBulkAttachFitments
>;

export const AdminUpdateSupplier = z
  .strictObject({
    markup_percentage: z.number().min(0).optional(),
    released_kinds: z.array(z.enum(STAGED_DATA_KINDS)).optional(),
  })
  .refine((body) => Object.keys(body).length > 0);
export type AdminUpdateSupplierType = z.infer<typeof AdminUpdateSupplier>;

export const AdminCreateSupplierCategory = z.strictObject({
  code: z.string().trim().min(1),
  category_id: z.string().min(1),
});
export type AdminCreateSupplierCategoryType = z.infer<
  typeof AdminCreateSupplierCategory
>;

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
  maintenance_kit: z.boolean(),
  kit_rank: z.number().int(),
};

export const AdminCreateCategory = z.strictObject({
  slug: catalogKey,
  ...categoryColumns,
  text: categoryColumns.text.default(''),
  maintenance_kit: categoryColumns.maintenance_kit.default(false),
  kit_rank: categoryColumns.kit_rank.default(0),
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

const REQUIREMENT_OWNERS = ['engine_id', 'chassis_id', 'vehicle_id'] as const;

const requirementOwners = {
  engine_id: z.string().min(1).optional(),
  chassis_id: z.string().min(1).optional(),
  vehicle_id: z.string().min(1).optional(),
};

export const AdminListRequirements = z.object(requirementOwners);
export type AdminListRequirementsType = z.infer<typeof AdminListRequirements>;

export const AdminCreateRequirement = z
  .strictObject({
    field_id: z.string().min(1),
    ...requirementOwners,
    option_keys: z.array(z.string().trim().min(1)).nullable().default(null),
    min: z.number().nullable().default(null),
    max: z.number().nullable().default(null),
    quantity: z.number().int().positive().default(1),
  })
  .refine(
    (requirement) =>
      REQUIREMENT_OWNERS.filter((owner) => requirement[owner]).length === 1,
    { message: 'Exactly one of engine_id, chassis_id, vehicle_id' },
  );
export type AdminCreateRequirementType = z.infer<typeof AdminCreateRequirement>;
