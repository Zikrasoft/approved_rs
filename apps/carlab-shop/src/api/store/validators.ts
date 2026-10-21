import { z } from '@medusajs/framework/zod';
import { CATALOG_LOCALES, STEERING_SIDES } from '@podbor/catalog-contract';

export const StoreSearchParts = z.object({
  q: z.string().trim().min(1).max(200),
  vehicle_id: z.string().min(1).optional(),
  facets: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => [value].flat())
    .pipe(z.array(z.string().regex(/^[a-z0-9-]+:[^`]+$/)).max(20))
    .default([]),
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type StoreSearchPartsType = z.infer<typeof StoreSearchParts>;

export const StoreCreateVinLookup = z.object({
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/),
});
export type StoreCreateVinLookupType = z.infer<typeof StoreCreateVinLookup>;

export const StoreCreateOfferCart = z.object({
  email: z.email().optional(),
});
export type StoreCreateOfferCartType = z.infer<typeof StoreCreateOfferCart>;

export const StoreAddOfferCartItem = z.object({
  offer_id: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});
export type StoreAddOfferCartItemType = z.infer<typeof StoreAddOfferCartItem>;

export const StoreCompleteOfferCart = z.object({
  contact: z.string().trim().min(1).max(200),
  contact_channel: z
    .enum(['phone', 'telegram', 'whatsapp', 'viber'])
    .optional(),
  name: z.string().trim().max(200).optional(),
  vin: z.string().trim().max(200).optional(),
  comment: z.string().trim().max(2000).optional(),
  locale: z.enum(CATALOG_LOCALES).optional(),
});
export type StoreCompleteOfferCartType = z.infer<typeof StoreCompleteOfferCart>;

export const StoreListPartPages = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(5000).default(1000),
});
export type StoreListPartPagesType = z.infer<typeof StoreListPartPages>;

export const StoreListFitments = StoreListPartPages;
export type StoreListFitmentsType = StoreListPartPagesType;

export const StoreVehicleParts = z.object({
  steering: z.enum(STEERING_SIDES).optional(),
});
export type StoreVehiclePartsType = z.infer<typeof StoreVehicleParts>;
