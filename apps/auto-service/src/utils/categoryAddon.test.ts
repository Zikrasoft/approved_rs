import { describe, expect, it } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { categoryAddon } from './categoryAddon';

const batteries: Category = {
  id: 'category_1',
  slug: 'batteries',
  name: 'Аккумуляторы',
  text: '',
  translations: { sr: { name: 'Akumulatori', service_label: 'Registracija' } },
  maintenance_kit: false,
  kit_rank: 0,
  service_label: 'Регистрация аккумулятора',
  service_price: 2500,
  fields: [],
};

describe('categoryAddon', () => {
  it('names the add-on service in the visitor language with its price', () => {
    expect(categoryAddon(batteries, 'sr')).toEqual({
      label: 'Registracija',
      price: 2500,
    });
    expect(categoryAddon(batteries, 'en')).toEqual({
      label: 'Регистрация аккумулятора',
      price: 2500,
    });
  });

  it('has none for a Category without a priced service or no Category', () => {
    expect(
      categoryAddon({ ...batteries, service_price: null }, 'ru'),
    ).toBeNull();
    expect(categoryAddon(null, 'ru')).toBeNull();
  });
});
