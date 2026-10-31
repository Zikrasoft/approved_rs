import { z } from 'zod';
import {
  orderContactObject,
  withValidContact,
} from '@podbor/lead-crm/shop-orders-wire';
import { partOfferSchema } from './partPages.ts';
import { CATALOG_LOCALES } from './search.ts';
import { offerCartSchema } from './cart-wire.ts';
import { vinOf } from '@podbor/lead-crm/vin';

export * from './cart-wire.ts';

export const CHECKOUT_REFUSALS = [
  'OFFER_PRICE_CHANGED',
  'OFFER_OUT_OF_STOCK',
  'OFFER_MISSING',
  'CONTACT_MISSING',
  'CART_CHANGED',
] as const;

export const checkoutRefusalSchema = z.object({
  code: z.enum(CHECKOUT_REFUSALS),
});

export const offerCartResponseSchema = z.object({ cart: offerCartSchema });

export const placedOrderResponseSchema = z.object({
  order: z.object({ id: z.string(), display_id: z.number().int() }),
});

export const orderCaseSummaryResponseSchema = z.object({
  summary: z.object({
    display_id: z.number().int(),
    car: z
      .object({
        make: z.string(),
        model: z.string(),
        year: z.number().int().nullable().default(null),
      })
      .nullable()
      .default(null),
    parts: z.array(z.object({ brand: z.string(), number: z.string() })),
    total_rsd: z.number().int().nullable().default(null),
  }),
});

export type OrderCaseSummary = z.infer<
  typeof orderCaseSummaryResponseSchema
>['summary'];

export const partOffersResponseSchema = z.object({
  offers: z.array(partOfferSchema),
});

export const identifierOffersResponseSchema = z.object({
  offers: z.record(z.string(), z.array(partOfferSchema)),
  installation: z
    .record(z.string(), z.number().int().nonnegative().nullable())
    .default({}),
});

export const checkoutContactSchema = withValidContact(
  orderContactObject.extend({
    vin: orderContactObject.shape.vin.transform(
      (value) => (value && vinOf(value)) || value,
    ),
    locale: z.enum(CATALOG_LOCALES).optional(),
  }),
);

export type CheckoutContact = z.input<typeof checkoutContactSchema>;
export type CheckoutRefusal = (typeof CHECKOUT_REFUSALS)[number];
