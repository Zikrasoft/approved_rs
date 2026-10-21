export const formatMoney = (
  amount: number,
  currency: string,
  localeTag: string,
): string => `${amount.toLocaleString(localeTag)} ${currency}`;
