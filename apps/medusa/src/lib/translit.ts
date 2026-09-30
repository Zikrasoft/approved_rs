import slugify from 'slugify';

export const translit = (text: string): string =>
  slugify(text, { lower: true, strict: true, locale: 'ru' });

export const isLatin = (text: string): boolean => /^[a-z0-9-]+$/.test(text);
