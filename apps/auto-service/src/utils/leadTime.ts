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
  tomorrow?: string;
  days: PluralForms;
};

export function formatLeadTime(
  days: number,
  copy: LeadTimeCopy,
  localeTag: string,
): string {
  if (days === 0) {
    return copy.inStock;
  }
  if (days === 1 && copy.tomorrow) {
    return copy.tomorrow;
  }
  return plural(days, copy.days, localeTag).replace('{days}', String(days));
}

export type AvailabilityCopy = {
  columns: { stock: string; leadTime: string; inStockPickup: string };
  leadTime: LeadTimeCopy;
};

export function offerAvailability(
  offer: OfferAvailability,
  { columns, leadTime }: AvailabilityCopy,
  localeTag: string,
): { stock: string | null; lead: string | null; buyable: boolean } {
  const days =
    offer.lead_time_days > 0
      ? formatLeadTime(offer.lead_time_days, leadTime, localeTag)
      : null;
  const inStock = offer.stock_quantity > 0;
  return {
    stock: inStock
      ? days
        ? columns.inStockPickup.replace('{days}', days)
        : columns.stock
      : null,
    lead: !inStock && days ? `${columns.leadTime} ${days}` : null,
    buyable: isBuyable(offer),
  };
}
