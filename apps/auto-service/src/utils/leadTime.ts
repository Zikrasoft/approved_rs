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
