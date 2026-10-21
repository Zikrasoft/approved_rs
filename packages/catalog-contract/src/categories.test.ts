import { describe, expect, it } from 'vitest';
import { categorySchema, translated } from './categories.ts';

const category = {
  id: 'category_1',
  slug: 'engine-oil',
  name: 'Моторное масло',
  text: 'Масло для двигателя.',
  translations: { sr: { name: 'Motorno ulje', text: '' } },
  fields: [
    {
      key: 'viscosity',
      type: 'single-select',
      unit: null,
      label: 'Вязкость',
      translations: null,
      required: true,
      facet: true,
      rank: 1,
      options: [{ key: '5w-30', label: '5W-30', translations: null, rank: 0 }],
    },
  ],
};

describe('categorySchema', () => {
  it('accepts a Category with its fields and options', () => {
    expect(categorySchema.parse(category)).toEqual(category);
  });

  it('refuses an upper-case field key', () => {
    const fields = [{ ...category.fields[0], key: 'Viscosity' }];
    expect(categorySchema.safeParse({ ...category, fields }).success).toBe(
      false,
    );
  });
});

describe('translated', () => {
  it('reads the translation for the locale', () => {
    expect(translated(category, 'name', 'sr')).toBe('Motorno ulje');
  });

  it.each([
    ['a blank translation', 'text', 'sr'],
    ['a missing locale', 'name', 'en'],
    ['the Russian source', 'name', 'ru'],
  ] as const)('falls back to Russian for %s', (_, column, locale) => {
    expect(translated(category, column, locale)).toBe(category[column]);
  });

  it('falls back to Russian without translations', () => {
    expect(translated({ ...category, translations: null }, 'name', 'sr')).toBe(
      'Моторное масло',
    );
  });
});
