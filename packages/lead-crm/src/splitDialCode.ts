const INTERNATIONAL_PREFIX = /^\s*(?:\+|00)/;

export interface DialSplit {
  iso: string;
  dial: string;
  rest: string;
}

export interface DialCandidate {
  iso: string;
  dial: string;
  primary?: boolean;
}

export function splitDialCode(
  typed: string,
  countries: readonly DialCandidate[],
): DialSplit | null {
  if (!INTERNATIONAL_PREFIX.test(typed)) return null;

  const digits = typed.replace(INTERNATIONAL_PREFIX, '').replace(/\D/g, '');
  if (!digits) return null;

  const fits = (country: DialCandidate) =>
    country.dial !== '' && digits.startsWith(country.dial);
  const match =
    countries.find((c) => c.primary && fits(c)) ?? countries.find(fits);
  if (!match) return null;

  return {
    iso: match.iso,
    dial: match.dial,
    rest: digits.slice(match.dial.length),
  };
}
