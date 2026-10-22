export type LeadTimeCopy = {
  inStock: string;
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
  const form = new Intl.PluralRules(localeTag).select(days);
  return (copy.days[form] ?? copy.days.other).replace('{days}', String(days));
}

export type AvailabilityCopy = {
  stock: string;
  leadTime: string;
  inStockPickup: string;
  days: LeadTimeCopy;
};

export function availabilityText(
  { in_stock, lead_time_days }: { in_stock: boolean; lead_time_days: number },
  copy: AvailabilityCopy,
  localeTag: string,
): string | null {
  const days =
    lead_time_days > 0
      ? formatLeadTime(lead_time_days, copy.days, localeTag)
      : null;
  if (in_stock) {
    return days ? copy.inStockPickup.replace('{days}', days) : copy.stock;
  }
  return days && `${copy.leadTime} ${days}`;
}
