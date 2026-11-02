import { describe, expect, it } from 'vitest';
import type { MakeHubEntry, ModelHubEntry } from './catalogueSnapshot';
import { categoryCars } from './categoryCars';

const model = (make: string, slug: string, name: string, code: string) =>
  ({
    slug,
    name,
    chassis: {
      code,
      series: {
        name: make === 'bmw' ? '3 серия' : 'E-Класс',
        translations: null,
        make: { slug: make, name: make === 'bmw' ? 'BMW' : 'Mercedes-Benz' },
      },
    },
  }) as unknown as ModelHubEntry['model'];

const hub = (
  make: string,
  models: [ModelHubEntry['model'], string[]][],
): MakeHubEntry =>
  ({
    make: { slug: make, name: make === 'bmw' ? 'BMW' : 'Mercedes-Benz' },
    parts: 1,
    models: models.map(([entry, categories]) => ({
      make: { slug: make },
      model: entry,
      vehicles: [],
      categories: categories.map((slug) => ({
        category: { slug },
        parts: [],
      })),
    })),
  }) as unknown as MakeHubEntry;

const f30i = model('bmw', 'f30-320i', '320i', 'F30');
const f30d = model('bmw', 'f30-320d', '320d', 'F30');
const w213 = model('mercedes-benz', 'w213-e220d', 'E 220 d', 'W213');

describe('categoryCars', () => {
  const hubs = [
    hub('bmw', [
      [f30i, ['batteries']],
      [f30d, ['batteries', 'oil-filters']],
    ]),
    hub('mercedes-benz', [[w213, ['oil-filters']]]),
  ];

  it('lists each make with the models whose model-category page the category has', () => {
    expect(categoryCars(hubs, 'oil-filters')).toEqual([
      { make: { slug: 'bmw', name: 'BMW' }, models: [f30d] },
      {
        make: { slug: 'mercedes-benz', name: 'Mercedes-Benz' },
        models: [w213],
      },
    ]);
  });

  it('sorts the models of a make by name and leaves out a make with none', () => {
    expect(categoryCars(hubs, 'batteries')).toEqual([
      { make: { slug: 'bmw', name: 'BMW' }, models: [f30d, f30i] },
    ]);
  });

  it('offers no car for a category no model has a page in', () => {
    expect(categoryCars(hubs, 'body-parts')).toEqual([]);
  });
});
