export const normalizePartNumber = (raw: string): string =>
  raw.replace(/[\s./-]/g, '').toUpperCase();

export const partPageSlug = (
  brandSlug: string,
  normalizedValue: string,
): string => `${brandSlug}-${normalizedValue.toLowerCase()}`;
