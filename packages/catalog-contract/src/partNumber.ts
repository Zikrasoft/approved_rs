const CYRILLIC_LOOKALIKES = 'АВЕКМНОРСТУХЈЅ';
const LATIN_TWINS = 'ABEKMHOPCTYXJS';

export const normalizePartNumber = (raw: string): string | null =>
  raw
    .normalize('NFKD')
    .toUpperCase()
    .replace(
      new RegExp(`[${CYRILLIC_LOOKALIKES}]`, 'g'),
      (letter) => LATIN_TWINS[CYRILLIC_LOOKALIKES.indexOf(letter)],
    )
    .replace(/[^A-Z0-9]/g, '') || null;

export const partPageSlug = (
  brandSlug: string,
  normalizedValue: string,
): string => `${brandSlug}-${normalizedValue.toLowerCase()}`;

const WORD = /^\p{L}{3,}$/u;

export const partNumberQuery = (raw: string): string | null => {
  const number = normalizePartNumber(raw);
  return number !== null &&
    number.length >= 6 &&
    /\d{3}/.test(number) &&
    !raw.split(/\s+/).some((token) => WORD.test(token))
    ? number
    : null;
};

const bare = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export interface PartTitle {
  name: string;
  number: string | null;
}

export const partTitle = ({
  brand,
  number,
  name,
}: {
  brand: string;
  number: string;
  name: string;
}): PartTitle => {
  const words = name.split(/\s+/);
  const tails = [bare(`${brand}${number}`), bare(number)];
  let rest = name;
  for (let tail = words.length - 1; tail > 0; tail--) {
    const head = words.slice(0, -tail).join(' ');
    if (
      tails.includes(bare(words.slice(-tail).join(''))) &&
      bare(head) !== bare(brand)
    ) {
      rest = head.replace(/[\s,]+$/, '');
      break;
    }
  }
  const key = normalizePartNumber(number);
  return {
    name: rest,
    number:
      key && normalizePartNumber(rest)?.includes(key)
        ? null
        : `${brand} ${number}`,
  };
};

export const orderLineTitle = (part: {
  brand: string;
  number: string;
  name: string;
}): string => {
  const { name, number } = partTitle(part);
  return number ? `${name} (${number})` : name;
};
