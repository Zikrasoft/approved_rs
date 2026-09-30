export const MEDUSA_LOCALE = {
  ru: 'ru-RU',
  sr: 'sr-RS',
  en: 'en-US',
} as const;

export function formatPrice(amount: number, bcp47: string): string {
  return new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency: 'RSD',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
