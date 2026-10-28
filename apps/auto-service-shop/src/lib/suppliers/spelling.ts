export const spellingKey = (value: string): string =>
  value
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toUpperCase()
    .normalize('NFKC');
