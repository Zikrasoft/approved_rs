import { z } from 'zod';
import { TRACKED_CONTACT_CHANNELS } from '@podbor/lead-crm/contact-channel';
import { MAX_COMMENT_LENGTH, MAX_FIELD_LENGTH } from '@podbor/lead-crm/limits';
import { isValidContact } from '@podbor/lead-crm/phone';
import { partOfferSchema } from './partPages.ts';
import { CATALOG_LOCALES } from './search.ts';

export const CHECKOUT_REFUSALS = [
  'OFFER_PRICE_CHANGED',
  'OFFER_OUT_OF_STOCK',
  'OFFER_MISSING',
  'CONTACT_MISSING',
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

export const offerCartLineSchema = z.object({
  id: z.string(),
  offer_id: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  available: z.boolean(),
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

export const partOffersResponseSchema = z.object({
  offers: z.array(partOfferSchema),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || undefined);

export const checkoutContactSchema = z
  .object({
    contact: z.string().trim().min(1).max(MAX_FIELD_LENGTH),
    contact_channel: z
      .enum(TRACKED_CONTACT_CHANNELS)
      .optional()
      .catch(undefined),
    name: optionalText(MAX_FIELD_LENGTH),
    vin: optionalText(MAX_FIELD_LENGTH),
    car: optionalText(MAX_FIELD_LENGTH),
    comment: optionalText(MAX_COMMENT_LENGTH),
    locale: z.enum(CATALOG_LOCALES).optional(),
  })
  .refine(({ contact, contact_channel }) =>
    isValidContact(contact, contact_channel ?? null),
  );

export type CheckoutContact = z.input<typeof checkoutContactSchema>;
export type CheckoutRefusal = (typeof CHECKOUT_REFUSALS)[number];
export type ListedPart = z.infer<typeof listedPartSchema>;
export type OfferCartLine = z.infer<typeof offerCartLineSchema>;
export type OfferCart = z.infer<typeof offerCartSchema>;
