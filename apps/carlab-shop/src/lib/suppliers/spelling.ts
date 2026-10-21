export const spellingKey = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toUpperCase();
