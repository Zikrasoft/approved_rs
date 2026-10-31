import * as z from 'zod/mini';

export const ADDON_KINDS = ['service', 'installation'] as const;
export type AddonKind = (typeof ADDON_KINDS)[number];

export const CHECKOUT_REFUSALS = [
  'OFFER_PRICE_CHANGED',
  'OFFER_OUT_OF_STOCK',
  'OFFER_MISSING',
  'CONTACT_MISSING',
  'CART_CHANGED',
] as const;
export type CheckoutRefusal = (typeof CHECKOUT_REFUSALS)[number];

const whole = z.int().check(z.nonnegative());

export const partOfferSchema = z.object({
  id: z.string(),
  price: z.number(),
  currency: z.string(),
  stock_quantity: whole,
  lead_time_days: whole,
});

const labels = z.optional(z.record(z.string(), z.string()));

export const listedPartSchema = z.object({
  slug: z.string(),
  brand: z.string(),
  number: z.string(),
  name: z.string(),
});

export const lineAddonSchema = z.object({
  item_id: z.nullable(z.string()),
  label: z.string(),
  translations: z.nullable(z.object({ sr: labels, en: labels })),
  unit_price: whole,
});

export const lineInstallationSchema = z.object({
  item_id: z.nullable(z.string()),
  unit_price: whole,
});

export const offerCartLineSchema = z.object({
  id: z.string(),
  offer_id: z.string(),
  quantity: z.int().check(z.positive()),
  unit_price: z.number().check(z.nonnegative()),
  available: z.boolean(),
  in_stock: z.boolean(),
  lead_time_days: z.int().check(z.nonnegative()),
  max_quantity: z._default(z.nullable(z.int().check(z.nonnegative())), null),
  addon: z.nullable(lineAddonSchema),
  installation: z._default(z.nullable(lineInstallationSchema), null),
  part: listedPartSchema,
});

export const offerCartSchema = z.object({
  id: z.string(),
  completed: z.boolean(),
  currency: z.string(),
  total: z.number().check(z.nonnegative()),
  items: z.array(offerCartLineSchema),
});

export type PartOffer = z.infer<typeof partOfferSchema>;
export type ListedPart = z.infer<typeof listedPartSchema>;
export type LineAddon = z.infer<typeof lineAddonSchema>;
export type LineInstallation = z.infer<typeof lineInstallationSchema>;
export type OfferCartLine = z.infer<typeof offerCartLineSchema>;
export type OfferCart = z.infer<typeof offerCartSchema>;
