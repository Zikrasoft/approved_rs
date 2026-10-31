import { z } from 'zod';
import {
  orderContactObject,
  withValidContact,
} from '@podbor/lead-crm/shop-orders-wire';
import { partOfferSchema } from './partPages.ts';
import { CATALOG_LOCALES } from './search.ts';
import { translationsSchema } from './translations.ts';
import { vinOf } from './vin.ts';

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

export const listedPartSchema = z.object({
  slug: z.string(),
  brand: z.string(),
  number: z.string(),
  name: z.string(),
});

export const lineAddonSchema = z.object({
  item_id: z.string().nullable(),
  label: z.string(),
  translations: translationsSchema,
  unit_price: z.number().int().nonnegative(),
});

export const lineInstallationSchema = z.object({
  item_id: z.string().nullable(),
  unit_price: z.number().int().nonnegative(),
});

export const offerCartLineSchema = z.object({
  id: z.string(),
  offer_id: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  available: z.boolean(),
  in_stock: z.boolean(),
  lead_time_days: z.number().int().nonnegative(),
  max_quantity: z.number().int().nonnegative().nullable().default(null),
  addon: lineAddonSchema.nullable(),
  installation: lineInstallationSchema.nullable().default(null),
  part: listedPartSchema,
});

export const offerCartSchema = z.object({
  id: z.string(),
  completed: z.boolean(),
  currency: z.string(),
  total: z.number().nonnegative(),
  items: z.array(offerCartLineSchema),
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
export type ListedPart = z.infer<typeof listedPartSchema>;
export type LineAddon = z.infer<typeof lineAddonSchema>;
export type LineInstallation = z.infer<typeof lineInstallationSchema>;
export type OfferCartLine = z.infer<typeof offerCartLineSchema>;
export type OfferCart = z.infer<typeof offerCartSchema>;
