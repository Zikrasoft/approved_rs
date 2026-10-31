import { z } from 'zod';
import { TRACKED_CONTACT_CHANNELS } from '@podbor/lead-crm/contact-channel';
import { AD_SOURCE_FIELD, META_IDS_FIELD } from '@podbor/lead-crm/fields';
import {
  MAX_COMMENT_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_URL_LENGTH,
} from '@podbor/lead-crm/limits';
import {
  isValidContact,
  plainText,
  singleLine,
  storedContact,
} from '@podbor/lead-crm/phone';
import { partOfferSchema } from './partPages.ts';
import { CATALOG_LOCALES } from './search.ts';
import { offerCartSchema } from './cart-wire.ts';
import { vinOf } from './vin.ts';

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

const attribution = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .catch(undefined)
    .transform((value) => value || undefined);

const optionalText = (max: number, clean = singleLine) =>
  z
    .string()
    .transform(clean)
    .pipe(z.string().max(max))
    .nullish()
    .transform((value) => value || undefined);

export const checkoutContactSchema = z
  .object({
    contact: z
      .string()
      .transform(singleLine)
      .pipe(z.string().min(1).max(MAX_FIELD_LENGTH)),
    contact_channel: z
      .enum(TRACKED_CONTACT_CHANNELS)
      .optional()
      .catch(undefined),
    name: optionalText(MAX_FIELD_LENGTH),
    vin: optionalText(MAX_FIELD_LENGTH).transform(
      (value) => (value && vinOf(value)) || value,
    ),
    car: optionalText(MAX_FIELD_LENGTH),
    comment: optionalText(MAX_COMMENT_LENGTH, plainText),
    locale: z.enum(CATALOG_LOCALES).optional(),
    source_url: attribution(MAX_URL_LENGTH),
    visitor_id: attribution(MAX_FIELD_LENGTH),
    [AD_SOURCE_FIELD]: attribution(MAX_COMMENT_LENGTH),
    [META_IDS_FIELD]: attribution(MAX_COMMENT_LENGTH),
  })
  .refine(({ contact, contact_channel }) =>
    isValidContact(contact, contact_channel ?? null),
  )
  .transform((value) => ({ ...value, contact: storedContact(value.contact) }));

export type CheckoutContact = z.input<typeof checkoutContactSchema>;
export type CheckoutRefusal = (typeof CHECKOUT_REFUSALS)[number];
