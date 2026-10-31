import {
  fromRussianLayout,
  toRussianLayout,
} from '@podbor/lead-crm/keyboard-layout';

const RUSSIAN_WORDS = /^[\sа-яё]+$/i;
const LATIN_WORDS = /^[\sa-z[\];',.`]+$/i;

export const otherLayout = (text: string): string | null => {
  if (!/\S/.test(text)) return null;
  if (RUSSIAN_WORDS.test(text)) return fromRussianLayout(text);
  if (LATIN_WORDS.test(text)) return toRussianLayout(text);
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
