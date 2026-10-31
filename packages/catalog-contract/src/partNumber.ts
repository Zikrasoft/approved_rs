export const normalizePartNumber = (raw: string): string =>
  raw.replace(/[\s./-]/g, '').toUpperCase();

export const partPageSlug = (
  brandSlug: string,
  normalizedValue: string,
): string => `${brandSlug}-${normalizedValue.toLowerCase()}`;

const WORD = /^\p{L}{3,}$/u;

export const partNumberQuery = (raw: string): string | null => {
  const number = normalizePartNumber(raw);
  return number.length >= 6 &&
    /\d{3}/.test(number) &&
    !raw.split(/\s+/).some((token) => WORD.test(token))
    ? number
    : null;
};
