import { z } from '@medusajs/framework/zod';
import {
  BRAND_SLUG_PATTERN,
  normalizePartNumber,
} from '@podbor/catalog-contract';

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

export const AdminCreateBrandSpelling = z.strictObject({
  supplier_id: z.string().min(1),
  value: z.string().trim().min(1),
});
export type AdminCreateBrandSpellingType = z.infer<
  typeof AdminCreateBrandSpelling
>;
