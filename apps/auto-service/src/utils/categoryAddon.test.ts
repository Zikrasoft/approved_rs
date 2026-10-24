import { describe, expect, it } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { addonDataset, categoryAddon } from './categoryAddon';
import { listedPartFromDataset } from '@/scripts/partsList';

const batteries: Category = {
  id: 'category_1',
  slug: 'batteries',
  name: 'Аккумуляторы',
  text: '',
  translations: {
    sr: {
      name: 'Akumulatori',
      service_label: 'Registracija',
      service_note: 'Na BMW posle zamene treba registracija.',
    },
  },
  maintenance_kit: false,
  kit_rank: 0,
  service_label: 'Регистрация аккумулятора',
  service_price: 2500,
  service_note: 'На BMW после замены нужна регистрация.',
  installation_price: null,
  image: null,
  fields: [],
};

describe('categoryAddon', () => {
  it('names the add-on service and its note in the visitor language with its price', () => {
    expect(categoryAddon(batteries, 'sr')).toEqual({
      label: 'Registracija',
      price: 2500,
      note: 'Na BMW posle zamene treba registracija.',
    });
    expect(categoryAddon(batteries, 'en')).toEqual({
      label: 'Регистрация аккумулятора',
      price: 2500,
      note: 'На BMW после замены нужна регистрация.',
    });
  });

  it('has no note when the Category gives none', () => {
    expect(
      categoryAddon({ ...batteries, service_note: null }, 'sr')?.note,
    ).toBeNull();
  });

  it('has none for a Category without a priced service or no Category', () => {
    expect(
      categoryAddon({ ...batteries, service_price: null }, 'ru'),
    ).toBeNull();
    expect(categoryAddon(null, 'ru')).toBeNull();
  });
});

describe('addonDataset', () => {
  const asDataset = (attributes: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(attributes).map(([name, value]) => [
        name
          .replace(/^data-/, '')
          .replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()),
        value,
      ]),
    );

  it('hands a listed part the Russian label, its translations and the price', () => {
    expect(
      listedPartFromDataset(
        asDataset({
          'data-slug': 'varta-e11',
          'data-brand': 'Varta',
          'data-number': 'E11',
          'data-name': 'Akumulator',
          ...addonDataset(batteries),
        }),
      ),
    ).toEqual({
      slug: 'varta-e11',
      brand: 'Varta',
      number: 'E11',
      name: 'Akumulator',
      addon: 'Регистрация аккумулятора',
      addon_translations: { sr: { label: 'Registracija' } },
      addon_price: 2500,
    });
  });

  it('gives nothing to a Category without a priced service', () => {
    expect(addonDataset({ ...batteries, service_label: null })).toEqual({});
  });
});
