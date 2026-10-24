import { z } from '@medusajs/framework/zod';
import {
  BRAND_SLUG_PATTERN,
  CATALOG_TRANSLATION_LOCALES,
  CATALOG_KEY_PATTERN,
  CATEGORY_FIELD_TYPES,
  FITMENT_AXLES,
  FITMENT_SIDES,
  GEARBOX_TYPES,
  normalizePartNumber,
  STAGED_DATA_KINDS,
  STEERING_SIDES,
  UNIVERSAL_FACET_KEYS,
} from '@podbor/catalog-contract';

import { PART_IDENTIFIER_TYPES } from '../../modules/catalog/models/part-identifier';

export const MAX_NAME_LENGTH = 200;
export const MAX_PART_NUMBER_LENGTH = 50;
export const MAX_QUANTITY = 100;
export const MAX_SERVICE_PRICE = 1_000_000;

const INT4 = 2 ** 31 - 1;
export const int4 = z.number().int().min(-INT4).max(INT4);

const name = z.string().trim().min(1).max(MAX_NAME_LENGTH);

export const AdminSearchParts = z.object({
  q: z.string().trim().min(1),
});
export type AdminSearchPartsType = z.infer<typeof AdminSearchParts>;

const partNumber = z
  .string()
  .trim()
  .max(MAX_PART_NUMBER_LENGTH)
  .refine((value) => normalizePartNumber(value).length > 0);

const isEan = (value: string) => {
  const digits = value.replace(/\s/g, '');
  return (
    /^(\d{8}|\d{13})$/.test(digits) &&
    [...digits]
      .reverse()
      .reduce(
        (sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1),
        0,
      ) %
      10 ===
      0
  );
};

export const AdminAddPartIdentifier = z
  .strictObject({
    type: z.enum(PART_IDENTIFIER_TYPES),
    brand_id: z.string().min(1),
    value: partNumber,
  })
  .refine(({ type, value }) => type !== 'ean' || isEan(value), {
    path: ['ean'],
    message: 'Not an EAN-8 or EAN-13 with a valid check digit',
  });
export type AdminAddPartIdentifierType = z.infer<typeof AdminAddPartIdentifier>;

export const AdminCreatePart = z.strictObject({
  name,
  identifiers: z.array(AdminAddPartIdentifier).min(1),
  category_id: z.string().min(1).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
export type AdminCreatePartType = z.infer<typeof AdminCreatePart>;

const servicePrice = z.number().int().nonnegative().max(MAX_SERVICE_PRICE);

export const AdminUpdatePart = z.strictObject({
  name: name.optional(),
  installation_price: servicePrice.nullable().optional(),
  no_installation: z.boolean().optional(),
  replaced_by_id: z.string().min(1).nullable().optional(),
  category_id: z.string().min(1).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
export type AdminUpdatePartType = z.infer<typeof AdminUpdatePart>;

export const AdminOrderImages = z.strictObject({
  ids: z.array(z.string().min(1)),
});
export type AdminOrderImagesType = z.infer<typeof AdminOrderImages>;

export const AdminUpdatePartIdentifier = z.strictObject({
  superseded: z.boolean(),
});
export type AdminUpdatePartIdentifierType = z.infer<
  typeof AdminUpdatePartIdentifier
>;

export const AdminListPartIdentifiers = z.object({
  enriched: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  q: z.string().trim().optional(),
  category_id: z.string().min(1).optional(),
  part_id: z.string().min(1).optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
export type AdminListPartIdentifiersType = z.infer<
  typeof AdminListPartIdentifiers
>;

export const AdminListFitments = z.object({
  vehicle_id: z.string().min(1).optional(),
  part_id: z.string().min(1).optional(),
});
export type AdminListFitmentsType = z.infer<typeof AdminListFitments>;

const calendarDay = z.iso
  .date({ error: 'Not a date' })
  .transform((day) => new Date(day));

const quantity = z.number().int().positive().max(MAX_QUANTITY);

const fitmentConditions = {
  quantity: quantity.optional(),
  axle: z.enum(FITMENT_AXLES).nullable().optional(),
  side: z.enum(FITMENT_SIDES).nullable().optional(),
  production_from: calendarDay.nullable().optional(),
  production_to: calendarDay.nullable().optional(),
  steering: z.enum(STEERING_SIDES).nullable().optional(),
  gearbox: z.enum(GEARBOX_TYPES).nullable().optional(),
  note: z
    .string()
    .trim()
    .max(1000)
    .transform((note) => note || null)
    .nullable()
    .optional(),
};

type FitmentPeriod = {
  production_from?: Date | null;
  production_to?: Date | null;
};

const inOrder = ({ production_from, production_to }: FitmentPeriod) =>
  !production_from || !production_to || production_from <= production_to;

const ENDS_BEFORE_IT_STARTS = {
  path: ['production_to'],
  message: 'Ends before it starts',
};

export const AdminCreateFitment = z
  .strictObject({
    part_id: z.string().min(1),
    vehicle_id: z.string().min(1),
    confirm_conflicts: z.boolean().optional(),
    ...fitmentConditions,
  })
  .refine(inOrder, ENDS_BEFORE_IT_STARTS);
export type AdminCreateFitmentType = z.infer<typeof AdminCreateFitment>;

export const StoredFitmentPeriod = z
  .object({
    production_from: z.date().nullable(),
    production_to: z.date().nullable(),
  })
  .refine(inOrder, ENDS_BEFORE_IT_STARTS);

export const AdminUpdateFitment = z
  .strictObject(fitmentConditions)
  .refine((body) => Object.keys(body).length > 0)
  .refine(inOrder, ENDS_BEFORE_IT_STARTS);
export type AdminUpdateFitmentType = z.infer<typeof AdminUpdateFitment>;

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

const vehicleFilter = {
  part_id: z.string().min(1),
  vehicle_id: z.string().min(1).optional(),
  make_id: z.string().min(1).optional(),
  series_id: z.string().min(1).optional(),
  chassis_id: z.string().min(1).optional(),
  model_id: z.string().min(1).optional(),
  engine_id: z.string().min(1).optional(),
  engine_family: z.string().trim().toUpperCase().min(1).optional(),
  year_from: z.number().int().min(1900).max(2100).optional(),
  year_to: z.number().int().min(1900).max(2100).optional(),
};

type VehicleFilterBody = Partial<
  Record<(typeof VEHICLE_FILTER_KEYS)[number], unknown>
> & { year_from?: number; year_to?: number };

const hasVehicleFilter = (body: VehicleFilterBody) =>
  VEHICLE_FILTER_KEYS.some((key) => body[key] !== undefined);

const yearsInOrder = ({ year_from, year_to }: VehicleFilterBody) =>
  year_from === undefined || year_to === undefined || year_from <= year_to;

const PICK_A_FILTER = { message: 'Pick at least one Vehicle filter' };

const YEARS_OUT_OF_ORDER = {
  path: ['year_to'],
  message: 'Ends before it starts',
};

export const AdminBulkAttachFitments = z
  .strictObject({
    ...vehicleFilter,
    ...fitmentConditions,
    confirm_conflicts: z.boolean().optional(),
  })
  .refine(hasVehicleFilter, PICK_A_FILTER)
  .refine(yearsInOrder, YEARS_OUT_OF_ORDER)
  .refine(inOrder, ENDS_BEFORE_IT_STARTS);
export type AdminBulkAttachFitmentsType = z.infer<
  typeof AdminBulkAttachFitments
>;

export const AdminBulkDetachFitments = z
  .strictObject(vehicleFilter)
  .refine(hasVehicleFilter, PICK_A_FILTER)
  .refine(yearsInOrder, YEARS_OUT_OF_ORDER);
export type AdminBulkDetachFitmentsType = z.infer<
  typeof AdminBulkDetachFitments
>;

export const AdminUpdateSupplier = z
  .strictObject({
    markup_percentage: z.number().min(0).max(500).multipleOf(0.01).optional(),
    released_kinds: z.array(z.enum(STAGED_DATA_KINDS)).optional(),
    import_enabled: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0);
export type AdminUpdateSupplierType = z.infer<typeof AdminUpdateSupplier>;

export const AdminCreateSupplierCategory = z.strictObject({
  code: name,
  category_id: z.string().min(1),
});
export type AdminCreateSupplierCategoryType = z.infer<
  typeof AdminCreateSupplierCategory
>;

export const AdminCreateBrand = z.strictObject({
  name,
  slug: z.string().regex(BRAND_SLUG_PATTERN),
});
export type AdminCreateBrandType = z.infer<typeof AdminCreateBrand>;

export const AdminEditTranslation = z.strictObject({
  locale: z.enum(CATALOG_TRANSLATION_LOCALES),
  fields: z.record(z.string(), z.string().trim().min(1).max(2000)),
});
export type AdminEditTranslationType = z.infer<typeof AdminEditTranslation>;

export const AdminCreateBrandSpelling = z.strictObject({
  supplier_id: z.string().min(1),
  value: name,
});
export type AdminCreateBrandSpellingType = z.infer<
  typeof AdminCreateBrandSpelling
>;

const catalogKey = z.string().regex(CATALOG_KEY_PATTERN);

const categoryColumns = {
  name,
  text: z.string(),
  maintenance_kit: z.boolean(),
  kit_rank: int4,
  service_label: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .transform((label) => label || null),
  service_price: servicePrice.nullable(),
  installation_price: servicePrice.nullable(),
  service_note: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((note) => note || null),
};

export const AdminCreateCategory = z.strictObject({
  slug: catalogKey,
  ...categoryColumns,
  text: categoryColumns.text.default(''),
  maintenance_kit: categoryColumns.maintenance_kit.default(false),
  kit_rank: categoryColumns.kit_rank.default(0),
  service_label: categoryColumns.service_label.default(null),
  service_price: categoryColumns.service_price.default(null),
  service_note: categoryColumns.service_note.default(null),
  installation_price: categoryColumns.installation_price.default(null),
});
export type AdminCreateCategoryType = z.infer<typeof AdminCreateCategory>;

export const AdminUpdateCategory = z.strictObject(categoryColumns).partial();
export type AdminUpdateCategoryType = z.infer<typeof AdminUpdateCategory>;

const fieldColumns = {
  type: z.enum(CATEGORY_FIELD_TYPES),
  unit: z.string().trim().min(1).max(20).nullable(),
  label: name,
  required: z.boolean(),
  facet: z.boolean(),
  rank: int4,
};

export const AdminCreateCategoryField = z.strictObject({
  key: catalogKey.refine(
    (key) => !(UNIVERSAL_FACET_KEYS as readonly string[]).includes(key),
  ),
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
  label: name,
  rank: int4,
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
    min: z.number().nonnegative().nullable().default(null),
    max: z.number().nonnegative().nullable().default(null),
    quantity: quantity.default(1),
  })
  .refine(
    (requirement) =>
      REQUIREMENT_OWNERS.filter((owner) => requirement[owner]).length === 1,
    { message: 'Exactly one of engine_id, chassis_id, vehicle_id' },
  );
export type AdminCreateRequirementType = z.infer<typeof AdminCreateRequirement>;
