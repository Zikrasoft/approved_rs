import { z } from '@medusajs/framework/zod';

export const StoreSearchParts = z.object({
  q: z.string().trim().min(1),
  vehicle_id: z.string().min(1).optional(),
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

export const StoreListPartPages = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(5000).default(1000),
});
export type StoreListPartPagesType = z.infer<typeof StoreListPartPages>;
