const RUSSIAN_KEYS = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const LATIN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";

const retyped = (text: string, from: string, to: string): string =>
  [...text.toLowerCase()].map((key) => to[from.indexOf(key)] ?? key).join('');

export const fromRussianLayout = (text: string): string =>
  retyped(text, RUSSIAN_KEYS, LATIN_KEYS);

export const toRussianLayout = (text: string): string =>
  retyped(text, LATIN_KEYS, RUSSIAN_KEYS);
