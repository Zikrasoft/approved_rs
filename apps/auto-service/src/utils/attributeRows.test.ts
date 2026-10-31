import { describe, expect, it } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { attributeRows, keySpecs } from './attributeRows';

const field = {
  unit: null,
  translations: null,
  required: false,
  facet: false,
  rank: 0,
  options: [],
};

const oil: Category = {
  id: 'category_oil',
  slug: 'engine-oil',
  name: 'Моторное масло',
  text: '',
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: null,
  service_price: null,
  service_note: null,
  installation_price: null,
  image: null,
  fields: [
    {
      ...field,
      key: 'viscosity',
      type: 'single-select',
      label: 'Вязкость',
      translations: { sr: { label: 'Viskozitet' } },
      options: [{ key: '5w-30', label: '5W-30', translations: null, rank: 0 }],
    },
    {
      ...field,
      key: 'approvals',
      type: 'multi-select',
      label: 'Допуски',
      options: [
        {
          key: 'bmw-ll-04',
          label: 'BMW Longlife-04',
          translations: null,
          rank: 0,
        },
        { key: 'mb-229-51', label: 'MB 229.51', translations: null, rank: 1 },
      ],
    },
    { ...field, key: 'volume', type: 'number', unit: 'л', label: 'Объем' },
    { ...field, key: 'weight', type: 'number', label: 'Вес' },
    { ...field, key: 'synthetic', type: 'boolean', label: 'Синтетика' },
    { ...field, key: 'eco', type: 'boolean', label: 'Эко' },
    { ...field, key: 'code', type: 'text', label: 'Код' },
    { ...field, key: 'colour', type: 'text', label: 'Цвет' },
  ],
};

describe('attributeRows', () => {
  it('shows each filled field in rank order with labels, units and option names', () => {
    const rows = attributeRows(
      oil,
      {
        approvals: ['bmw-ll-04', 'mb-229-51'],
        viscosity: '5w-30',
        volume: 5,
        weight: 4.4,
        synthetic: true,
        eco: false,
        code: 'C3',
      },
      'sr',
      { yes: 'Da', no: 'Ne' },
    );

    expect(rows).toEqual([
      { label: 'Viskozitet', value: '5W-30' },
      { label: 'Допуски', value: 'BMW Longlife-04, MB 229.51' },
      { label: 'Объем', value: '5 l' },
      { label: 'Вес', value: '4,4' },
      { label: 'Синтетика', value: 'Da' },
      { label: 'Эко', value: 'Ne' },
      { label: 'Код', value: 'C3' },
    ]);
  });

  it('shows the key of an option the build does not know', () => {
    expect(
      attributeRows(oil, { viscosity: '0w-20' }, 'ru', { yes: '', no: '' }),
    ).toEqual([{ label: 'Вязкость', value: '0w-20' }]);
  });
});

describe('keySpecs', () => {
  it('lines up the first three filled values, skipping yes/no fields', () => {
    expect(
      keySpecs(
        oil,
        {
          synthetic: true,
          viscosity: '5w-30',
          volume: 5,
          weight: 4.4,
          code: 'X',
        },
        'ru',
      ),
    ).toBe('5W-30 · 5 л · 4,4');
  });

  it('formats decimals for the locale', () => {
    expect(keySpecs(oil, { volume: 1.5 }, 'en')).toBe('1.5 l');
    expect(keySpecs(oil, { volume: 1.5 }, 'sr')).toBe('1,5 l');
  });

  it('skips a value every part in the listing shares', () => {
    const listing = [
      { viscosity: '5w-30', volume: 5, weight: 4.4, code: 'X' },
      { viscosity: '5w-30', volume: 4, weight: 4.4, code: 'Y' },
    ];
    expect(keySpecs(oil, listing[0], 'ru', listing)).toBe('5 л · X');
  });

  it('keeps every value when the listing has a single part', () => {
    const only = { viscosity: '5w-30', volume: 5 };
    expect(keySpecs(oil, only, 'ru', [only])).toBe('5W-30 · 5 л');
  });

  it('is empty for a part with no filled fields', () => {
    expect(keySpecs(oil, {}, 'ru')).toBe('');
  });

  it('leaves out the fields the row already says', () => {
    expect(
      keySpecs(oil, { viscosity: '5w-30', volume: 5 }, 'ru', [], ['viscosity']),
    ).toBe('5 л');
  });
});
