import { describe, expect, it } from 'vitest';
import { partPage } from '@/components/renderAstro';
import { listedPartFromDataset } from '@/scripts/partsList';
import { partDataset } from './partDataset';

const pads = partPage({
  part: {
    ...partPage().part,
    translations: { sr: { name: 'Kočione pločice' } },
  },
});

const asDataset = (attributes: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(attributes).map(([name, value]) => [
      name
        .replace(/^data-/, '')
        .replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()),
      value,
    ]),
  );

describe('partDataset', () => {
  it('lists the part under its number and its name in the visitor language', () => {
    expect(listedPartFromDataset(asDataset(partDataset(pads, 'sr')))).toEqual({
      slug: 'bosch-0986494524',
      brand: 'Bosch',
      number: '0 986 494 524',
      name: 'Kočione pločice',
    });
  });

  it('carries the category add-on service when the category prices one', () => {
    const battery = partPage({
      category: {
        id: 'cat_batteries',
        slug: 'batteries',
        name: 'Аккумуляторы',
        text: '',
        translations: null,
        maintenance_kit: false,
        kit_rank: 0,
        service_label: 'Регистрация аккумулятора',
        service_price: 2500,
        service_note: null,
        installation_price: null,
        image: null,
        fields: [],
      },
    });

    expect(
      listedPartFromDataset(asDataset(partDataset(battery, 'ru'))),
    ).toMatchObject({ addon: 'Регистрация аккумулятора', addon_price: 2500 });
  });
});
