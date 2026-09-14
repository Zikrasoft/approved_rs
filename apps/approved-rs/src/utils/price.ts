import { BCP47_BY_LOCALE, type Locale } from '@/i18n/config';

export interface CasePrice {
  value: string;
  currency?: string;
}

// Number('') is 0, so without the first guard a case whose price the admin
// left blank renders a confident "0 €".
export function formatPrice(price: CasePrice, locale: Locale): string {
  if (!price.value) return '';
  const amount = Number(price.value);
  const value = Number.isFinite(amount)
    ? new Intl.NumberFormat(BCP47_BY_LOCALE[locale]).format(amount)
    : price.value;
  return price.currency ? `${value} ${price.currency}` : value;
}
