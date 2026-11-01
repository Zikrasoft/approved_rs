import { z } from '@medusajs/framework/zod';
import {
  CART_FINGERPRINT_FIELD,
  CATALOG_KEY_PATTERN,
  CATALOGUE_ID_PATTERN,
  checkoutContactSchema,
  FACET_FILTER_PATTERN,
  filteredKeyCount,
  MAX_LINE_QUANTITY,
  MAX_OFFER_IDS,
  MAX_PAGE,
  parseRangeFilter,
  SEARCH_FILTER_CAPS,
  vinSchema,
} from '@podbor/catalog-contract';

const recordId = z.string().regex(CATALOGUE_ID_PATTERN);

const MAX_SEARCH_OFFSET = 10_000;

const modelHasMake = ({ make, model }: { make?: string; model?: string }) =>
  !model || Boolean(make);

const MODEL_NEEDS_MAKE = 'model needs make';

export const StoreSearchParts = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    category: z.string().regex(CATALOG_KEY_PATTERN).optional(),
    vehicle_id: recordId.optional(),
    make: z.string().regex(CATALOG_KEY_PATTERN).optional(),
    model: z.string().regex(CATALOG_KEY_PATTERN).optional(),
    facets: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => [value].flat())
      .pipe(
        z
          .array(z.string().regex(FACET_FILTER_PATTERN))
          .max(SEARCH_FILTER_CAPS.facetValues),
      )
      .default([]),
    range: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => [value].flat())
      .pipe(
        z
          .array(
            z.string().transform((text, ctx) => {
              const range = parseRangeFilter(text);
              if (!range) {
                ctx.addIssue({ code: 'custom', message: 'invalid range' });
                return z.NEVER;
              }
              return range;
            }),
          )
          .max(SEARCH_FILTER_CAPS.ranges),
      )
      .default([]),
    offset: z.coerce
      .number()
      .int()
      .nonnegative()
      .transform((offset) => Math.min(offset, MAX_SEARCH_OFFSET))
      .default(0),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine(({ q, category }) => q || category, 'q or category is required')
  .refine(modelHasMake, MODEL_NEEDS_MAKE)
  .refine(
    ({ facets, range }) =>
      filteredKeyCount(facets, range) <= SEARCH_FILTER_CAPS.keys,
    `at most ${SEARCH_FILTER_CAPS.keys} filters`,
  );
export type StoreSearchPartsType = z.infer<typeof StoreSearchParts>;

export const StoreCreateVinLookup = z.object({ vin: vinSchema });
export type StoreCreateVinLookupType = z.infer<typeof StoreCreateVinLookup>;

const MAX_EMAIL_LOCAL_PART = 64;

const offerId = recordId;

const quantity = z.number().int().positive().max(MAX_LINE_QUANTITY);

export const StoreCreateOfferCart = z.object({
  email: z
    .email()
    .max(254)
    .refine((email) => email.indexOf('@') <= MAX_EMAIL_LOCAL_PART)
    .optional(),
  offer_id: offerId.optional(),
  quantity: quantity.default(1),
});
export type StoreCreateOfferCartType = z.infer<typeof StoreCreateOfferCart>;

export const StoreAddOfferCartItem = z.object({
  offer_id: offerId,
  quantity: quantity.default(1),
});
export type StoreAddOfferCartItemType = z.infer<typeof StoreAddOfferCartItem>;

export const StoreSetOfferCartItem = z.object({ quantity });
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
  after: recordId.optional(),
  limit: z.coerce.number().int().positive().max(MAX_PAGE).default(MAX_PAGE),
});
export type StoreListPartPagesType = z.infer<typeof StoreListPartPages>;

export const StoreListOffers = z.object({
  part_identifier_id: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => [value].flat())
    .pipe(z.array(recordId).min(1).max(MAX_OFFER_IDS)),
});
export type StoreListOffersType = z.infer<typeof StoreListOffers>;

export const StoreListFitments = StoreListPartPages;
export type StoreListFitmentsType = StoreListPartPagesType;

export const StoreListVehicles = StoreListPartPages.extend({
  make: z.string().regex(CATALOG_KEY_PATTERN).optional(),
  model: z.string().regex(CATALOG_KEY_PATTERN).optional(),
}).refine(modelHasMake, MODEL_NEEDS_MAKE);
export type StoreListVehiclesType = z.infer<typeof StoreListVehicles>;
