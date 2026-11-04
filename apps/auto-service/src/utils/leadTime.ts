import type { SchemaAvailability } from '@podbor/site-kit';
import * as z from 'zod/mini';
import type { ZodMiniType } from 'zod/mini';
import {
  isBuyable,
  type OfferAvailability,
} from '@podbor/catalog-contract/availability';

export const schemaAvailability = (
  offer: OfferAvailability,
): SchemaAvailability =>
  offer.stock_quantity > 0
    ? 'InStock'
    : isBuyable(offer)
      ? 'BackOrder'
      : 'OutOfStock';

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
};

export const plural = (
  count: number,
  forms: PluralForms,
  localeTag: string,
): string =>
  forms[new Intl.PluralRules(localeTag).select(count)] ?? forms.other;

export type LeadTimeCopy = {
  inStock: string;
  inStockTomorrow: string;
  inStockDays: PluralForms;
  tomorrow: string;
  days: PluralForms;
};

const sentence = (
  days: number,
  tomorrow: string,
  forms: PluralForms,
  localeTag: string,
) =>
  days === 1
    ? tomorrow
    : plural(days, forms, localeTag).replace('{days}', String(days));

export const pickupTime = (
  days: number,
  copy: LeadTimeCopy,
  localeTag: string,
): string => sentence(days, copy.tomorrow, copy.days, localeTag);

export type LineAvailability = { in_stock: boolean; lead_time_days: number };

export function offerAvailability(
  offer: OfferAvailability | LineAvailability,
  copy: LeadTimeCopy,
  localeTag: string,
  { short = false }: { short?: boolean } = {},
): { stock: string | null; lead: string | null; buyable: boolean } {
  const days = offer.lead_time_days;
  const inStock =
    'in_stock' in offer ? offer.in_stock : offer.stock_quantity > 0;
  return {
    stock: inStock
      ? days > 0 && !short
        ? sentence(days, copy.inStockTomorrow, copy.inStockDays, localeTag)
        : copy.inStock
      : null,
    lead: !inStock && days > 0 ? pickupTime(days, copy, localeTag) : null,
    buyable: inStock || days > 0,
  };
}

export const pluralFormsSchema = z.object({
  zero: z.optional(z.string()),
  one: z.optional(z.string()),
  two: z.optional(z.string()),
  few: z.optional(z.string()),
  many: z.optional(z.string()),
  other: z.string(),
});

const leadTimeCopySchema = z.object({
  inStock: z.string(),
  inStockTomorrow: z.string(),
  inStockDays: pluralFormsSchema,
  tomorrow: z.string(),
  days: pluralFormsSchema,
});

export function copyFrom<T>(
  schema: ZodMiniType<T>,
  json: string | undefined,
): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(json ?? ''));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const leadTimeCopyFrom = (json: string | undefined) =>
  copyFrom<LeadTimeCopy>(leadTimeCopySchema, json);
