const VIN_LETTERS = 'A-HJ-NPR-Z';

const MAKER_HAS_A_LETTER = `(?=[0-9]{0,2}[${VIN_LETTERS}])`;
const HAS_A_DIGIT = '(?=.*[0-9])';

export const VIN_PATTERN = new RegExp(
  `^${MAKER_HAS_A_LETTER}${HAS_A_DIGIT}[${VIN_LETTERS}0-9]{17}$`,
);

const LATIN_LOOKALIKES: Record<string, string> = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
};

const latinText = (text: string): string =>
  text
    .toUpperCase()
    .replace(/[АВЕКМНОРСТУХ]/g, (letter) => LATIN_LOOKALIKES[letter]!)
    .replace(/^\s*VIN\b\W*/, '');

export const vinText = (text: string): string =>
  latinText(text).replace(/[\s.-]+/g, '');

export const vinOf = (text: string): string | null => {
  const words = latinText(text)
    .split(/[^A-Z0-9.-]+/)
    .map((word) => word.replace(/[.-]+/g, ''));
  return (
    [vinText(text), ...words].find((word) => VIN_PATTERN.test(word)) ?? null
  );
};
