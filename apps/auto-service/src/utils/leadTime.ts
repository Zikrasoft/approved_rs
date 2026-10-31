import type { SchemaAvailability } from '@podbor/site-kit';
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

export function offerAvailability(
  offer: OfferAvailability,
  copy: LeadTimeCopy,
  localeTag: string,
): { stock: string | null; lead: string | null; buyable: boolean } {
  const days = offer.lead_time_days;
  const inStock = offer.stock_quantity > 0;
  return {
    stock: inStock
      ? days > 0
        ? sentence(days, copy.inStockTomorrow, copy.inStockDays, localeTag)
        : copy.inStock
      : null,
    lead: !inStock && days > 0 ? pickupTime(days, copy, localeTag) : null,
    buyable: isBuyable(offer),
  };
}
