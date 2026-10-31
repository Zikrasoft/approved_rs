const RUSSIAN_KEYS = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const LATIN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";

const retyped = (text: string, from: string, to: string): string =>
  [...text.toLowerCase()].map((key) => to[from.indexOf(key)] ?? key).join('');

export const fromRussianLayout = (text: string): string =>
  retyped(text, RUSSIAN_KEYS, LATIN_KEYS);

const RUSSIAN_WORDS = /^[\sа-яё]+$/i;
const LATIN_WORDS = /^[\sa-z[\];',.`]+$/i;

export const otherLayout = (text: string): string | null => {
  if (!/\S/.test(text)) return null;
  if (RUSSIAN_WORDS.test(text)) return fromRussianLayout(text);
  if (LATIN_WORDS.test(text)) return retyped(text, LATIN_KEYS, RUSSIAN_KEYS);
  return null;
};

type Hits = { results: readonly unknown[]; cars: readonly unknown[] };

export async function searchEitherLayout<T extends Hits>(
  typed: string,
  search: (q: string) => Promise<T | null>,
): Promise<{ q: string; found: T | null }> {
  const hit = (hits: T | null) =>
    Boolean(hits && (hits.results.length || hits.cars.length));
  const found = await search(typed);
  const other = found && !hit(found) ? otherLayout(typed) : null;
  const meant = other ? await search(other) : null;
  return other && hit(meant) ? { q: other, found: meant } : { q: typed, found };
}
