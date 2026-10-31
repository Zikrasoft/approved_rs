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

export type LeadTimeCopy = {
  inStock: string;
  tomorrow?: string;
  days: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
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
  const form = new Intl.PluralRules(localeTag).select(days);
  return (copy.days[form] ?? copy.days.other).replace('{days}', String(days));
}

export type AvailabilityCopy = {
  stock: string;
  leadTime: string;
  inStockPickup: string;
  days: LeadTimeCopy;
};

export const availabilityCopy = ({
  columns,
  leadTime,
}: {
  columns: { stock: string; leadTime: string; inStockPickup: string };
  leadTime: LeadTimeCopy;
}): AvailabilityCopy => ({
  stock: columns.stock,
  leadTime: columns.leadTime,
  inStockPickup: columns.inStockPickup,
  days: leadTime,
});

export function offerAvailability(
  offer: OfferAvailability,
  copy: AvailabilityCopy,
  localeTag: string,
): { stock: string | null; lead: string | null; buyable: boolean } {
  const days =
    offer.lead_time_days > 0
      ? formatLeadTime(offer.lead_time_days, copy.days, localeTag)
      : null;
  const inStock = offer.stock_quantity > 0;
  return {
    stock: inStock
      ? days
        ? copy.inStockPickup.replace('{days}', days)
        : copy.stock
      : null,
    lead: !inStock && days ? `${copy.leadTime} ${days}` : null,
    buyable: isBuyable(offer),
  };
}

export function availabilityText(
  { in_stock, lead_time_days }: { in_stock: boolean; lead_time_days: number },
  copy: AvailabilityCopy,
  localeTag: string,
): string | null {
  const { stock, lead } = offerAvailability(
    { stock_quantity: Number(in_stock), lead_time_days },
    copy,
    localeTag,
  );
  return stock ?? lead;
}
