const BRAND_ALIASES = new Map([
  ['варта', 'varta'],
  ['манн', 'mann'],
  ['бош', 'bosch'],
  ['кастрол', 'castrol'],
  ['кнехт', 'knecht'],
  ['брембо', 'brembo'],
  ['мобил', 'mobil'],
  ['шелл', 'shell'],
  ['мотюль', 'motul'],
  ['тотал', 'total'],
  ['махле', 'mahle'],
  ['филтрон', 'filtron'],
  ['сакс', 'sachs'],
  ['бмв', 'bmw'],
]);

// TODO: hand-kept alias list; move it to the shop's search synonyms once brands outgrow it
export const latinBrands = (q: string): string =>
  q.replace(
    /\p{L}+/gu,
    (word) => BRAND_ALIASES.get(word.toLowerCase()) ?? word,
  );
