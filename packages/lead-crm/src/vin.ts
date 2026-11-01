import { fromRussianLayout } from './keyboardLayout.ts';

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
    .replace(/^\s*VIN(?:\b\W*|(?=[A-Z0-9]{17}\s*$))/, '');

export const vinWhileTyping = (text: string): string =>
  text.replace(/[\s.-]+/g, '').toUpperCase();

const compactLatin = (text: string): string => vinWhileTyping(latinText(text));

const withoutForbiddenLetters = (word: string): string =>
  word.replace(/[OQ]/g, '0').replace(/I/g, '1');

const vinAsTyped = (
  text: string,
  read: (word: string) => string = (word) => word,
): string | null => {
  const words = latinText(text)
    .split(/[^A-Z0-9.-]+/)
    .map((word) => read(word.replace(/[.-]+/g, '')));
  return (
    [compactLatin(text), ...words].find((word) => VIN_PATTERN.test(word)) ??
    null
  );
};

export const vinOf = (text: string): string | null =>
  vinAsTyped(text, withoutForbiddenLetters) ??
  vinAsTyped(fromRussianLayout(text));

export const vinText = (text: string): string =>
  vinOf(text) ?? compactLatin(text);
