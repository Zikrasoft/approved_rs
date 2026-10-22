import { z } from '@medusajs/framework/zod';
import {
  CART_FINGERPRINT_FIELD,
  CATALOG_KEY_PATTERN,
  checkoutContactSchema,
  parseRangeFilter,
  STEERING_SIDES,
  vinSchema,
} from '@podbor/catalog-contract';

export const StoreSearchParts = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    category: z.string().regex(CATALOG_KEY_PATTERN).optional(),
    vehicle_id: z.string().min(1).optional(),
    facets: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => [value].flat())
      .pipe(z.array(z.string().regex(/^[a-z0-9-]+:[^`]+$/)).max(20))
      .default([]),
    range: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => [value].flat())
      .pipe(
        z
          .array(
            z.string().transform((text, ctx) => {
              const range = parseRangeFilter(text);
              if (
                !range ||
                (range.min !== null &&
                  range.max !== null &&
                  range.min > range.max)
              ) {
                ctx.addIssue({ code: 'custom', message: 'invalid range' });
                return z.NEVER;
              }
              return range;
            }),
          )
          .max(10),
      )
      .default([]),
    offset: z.coerce.number().int().nonnegative().default(0),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine(({ q, category }) => q || category, 'q or category is required');
export type StoreSearchPartsType = z.infer<typeof StoreSearchParts>;

export const StoreCreateVinLookup = z.object({ vin: vinSchema });
export type StoreCreateVinLookupType = z.infer<typeof StoreCreateVinLookup>;

export const StoreCreateOfferCart = z.object({
  email: z.email().optional(),
  offer_id: z.string().min(1).optional(),
  quantity: z.number().int().positive().default(1),
});
export type StoreCreateOfferCartType = z.infer<typeof StoreCreateOfferCart>;

export const StoreAddOfferCartItem = z.object({
  offer_id: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});
export type StoreAddOfferCartItemType = z.infer<typeof StoreAddOfferCartItem>;

export const StoreSetOfferCartItem = z.object({
  quantity: z.number().int().positive(),
});
export type StoreSetOfferCartItemType = z.infer<typeof StoreSetOfferCartItem>;

export const StoreAddLineAddon = z.strictObject({});

export const StoreCompleteOfferCart = z
  .record(z.string(), z.unknown())
  .transform((body, context) => {
    const contact = checkoutContactSchema.safeParse(body);
    if (!contact.success) {
      context.addIssue({ code: 'custom', message: contact.error.message });
      return z.NEVER;
    }
    const fingerprint = z
      .string()
      .min(1)
      .max(10_000)
      .safeParse(body[CART_FINGERPRINT_FIELD]);
    if (!fingerprint.success) {
      context.addIssue({ code: 'custom', message: fingerprint.error.message });
      return z.NEVER;
    }
    return { contact: contact.data, fingerprint: fingerprint.data };
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
