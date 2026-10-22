import { describe, expect, it } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { attributeRows } from './attributeRows';

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
    { ...field, key: 'volume', type: 'number', unit: 'l', label: 'Объем' },
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
      { label: 'Вес', value: '4.4' },
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
