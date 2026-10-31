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
  return {
    name: rest,
    number: normalizePartNumber(rest).includes(normalizePartNumber(number))
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
