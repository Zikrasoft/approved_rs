const DISALLOWED = /[^\p{L}\p{N} ._\-+|:/()&,#]/gu;
const MAX_AD_TEXT = 100;

export function cleanAdText(
  value: string | null | undefined,
): string | undefined {
  return (
    value?.replace(DISALLOWED, '').trim().slice(0, MAX_AD_TEXT).trim() ||
    undefined
  );
}
