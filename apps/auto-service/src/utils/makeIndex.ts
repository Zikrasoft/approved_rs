type Make = { slug: string; name: string };

type MakeCount = { make: Make; parts: number };

export type MakeLetter = { letter: string; makes: Make[] };

const byName = new Intl.Collator('en', { numeric: true }).compare;

const NOT_A_LETTER = '#';

export const TOP_MAKES = 12;

export const topMakes = <T extends MakeCount>(hubs: T[], count: number): T[] =>
  hubs.toSorted((a, b) => b.parts - a.parts).slice(0, count);

export function makesByLetter(hubs: MakeCount[]): MakeLetter[] {
  const letters = new Map<string, Make[]>();
  for (const { make } of hubs.toSorted((a, b) =>
    byName(a.make.name, b.make.name),
  )) {
    const first = make.name.charAt(0).toLocaleUpperCase('en');
    const letter = /\p{L}/u.test(first) ? first : NOT_A_LETTER;
    letters.set(letter, [...(letters.get(letter) ?? []), make]);
  }
  return [...letters.entries()]
    .map(([letter, makes]) => ({ letter, makes }))
    .sort((a, b) => byName(a.letter, b.letter));
}
