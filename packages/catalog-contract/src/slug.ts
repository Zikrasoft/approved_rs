const UNDECOMPOSED: Record<string, string> = {
  đ: 'dj',
  ß: 'ss',
  ł: 'l',
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
};

const withoutMarks = (name: string) =>
  name.normalize('NFKD').replace(/[̀-ͯ]/gu, '');

export const slugOf = (name: string) =>
  withoutMarks(name)
    .toLowerCase()
    .replace(/[đßłøæœ]/gu, (letter) => UNDECOMPOSED[letter])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const NAME_KEY_ALPHABET = /^[A-Za-z0-9\s._-]*$/;

const fnv1a = (text: string) => {
  let hash = 0x811c9dc5;
  for (const unit of new TextEncoder().encode(text)) {
    hash = Math.imul(hash ^ unit, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, '0').slice(-6);
};

export const seriesSlugOf = (name: string): string =>
  NAME_KEY_ALPHABET.test(withoutMarks(name))
    ? slugOf(name)
    : [slugOf(name), fnv1a(name)].filter(Boolean).join('-');
