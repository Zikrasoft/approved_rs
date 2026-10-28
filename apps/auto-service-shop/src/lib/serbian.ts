const LATIN_TO_CYRILLIC: [string, string][] = [
  ['dž', 'џ'],
  ['lj', 'љ'],
  ['nj', 'њ'],
  ['a', 'а'],
  ['b', 'б'],
  ['c', 'ц'],
  ['č', 'ч'],
  ['ć', 'ћ'],
  ['d', 'д'],
  ['đ', 'ђ'],
  ['e', 'е'],
  ['f', 'ф'],
  ['g', 'г'],
  ['h', 'х'],
  ['i', 'и'],
  ['j', 'ј'],
  ['k', 'к'],
  ['l', 'л'],
  ['m', 'м'],
  ['n', 'н'],
  ['o', 'о'],
  ['p', 'п'],
  ['r', 'р'],
  ['s', 'с'],
  ['š', 'ш'],
  ['t', 'т'],
  ['u', 'у'],
  ['v', 'в'],
  ['z', 'з'],
  ['ž', 'ж'],
];

const swap = (text: string, pairs: [string, string][]): string =>
  pairs.reduce((result, [from, to]) => result.replaceAll(from, to), text);

export const serbianScripts = (text: string) => {
  const lower = text.toLowerCase();
  const latin = swap(
    lower,
    LATIN_TO_CYRILLIC.map(([latn, cyrl]) => [cyrl, latn]),
  );
  return { latin, cyrillic: swap(latin, LATIN_TO_CYRILLIC) };
};
