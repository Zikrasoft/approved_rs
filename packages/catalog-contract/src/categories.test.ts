import { describe, expect, it } from 'vitest';
import { categorySchema, translated } from './categories.ts';

const category = {
  id: 'category_1',
  slug: 'engine-oil',
  name: 'Моторное масло',
  text: 'Масло для двигателя.',
  translations: { sr: { name: 'Motorno ulje', text: '' } },
  maintenance_kit: true,
  kit_rank: 1,
  service_label: null,
  service_price: null,
  service_note: null,
  installation_price: null,
  image: null,
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

  it('accepts a Category with an add-on service', () => {
    const serviced = {
      ...category,
      service_label: 'Регистрация аккумулятора',
      service_price: 2500,
      service_note: 'На BMW после замены нужна регистрация.',
    };
    expect(categorySchema.parse(serviced)).toEqual(serviced);
  });

  it('accepts a Category with an image', () => {
    const pictured = {
      ...category,
      image: {
        src: 'https://api.carlab.rs/static/oil-960.webp',
        width: 960,
        height: 720,
        srcset: [
          { url: 'https://api.carlab.rs/static/oil-160.webp', width: 160 },
          { url: 'https://api.carlab.rs/static/oil-960.webp', width: 960 },
        ],
      },
    };
    expect(categorySchema.parse(pictured)).toEqual(pictured);
  });

  it('accepts a Category that installs its parts at CarLab, free or priced', () => {
    expect(
      categorySchema.parse({ ...category, installation_price: 0 }),
    ).toEqual({ ...category, installation_price: 0 });
    const { installation_price: _, ...older } = category;
    expect(categorySchema.parse(older).installation_price).toBeNull();
  });

  it('refuses a fractional add-on price', () => {
    expect(
      categorySchema.safeParse({
        ...category,
        service_label: 'Регистрация аккумулятора',
        service_price: 2500.5,
      }).success,
    ).toBe(false);
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
