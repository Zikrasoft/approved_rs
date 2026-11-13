import { describe, expect, it } from 'vitest';
import type { MakeHubEntry, SeriesHubEntry } from './catalogueSnapshot';
import { categoryCars } from './categoryCars';

const series = (name: string, slug: string) =>
  ({ name, slug, translations: null }) as SeriesHubEntry['series'];

const hub = (
  make: string,
  entries: [SeriesHubEntry['series'], string[]][],
): MakeHubEntry =>
  ({
    make: { slug: make, name: make === 'bmw' ? 'BMW' : 'Mercedes-Benz' },
    parts: 1,
    series: entries.map(([entry, categories]) => ({
      make: { slug: make },
      series: entry,
      models: [],
      categories: categories.map((slug) => ({
        category: { slug },
        parts: [],
      })),
    })),
  }) as unknown as MakeHubEntry;

const three = series('3 Series', '3-series');
const five = series('5 Series', '5-series');
const eClass = series('E-Class', 'e-class');

describe('categoryCars', () => {
  const hubs = [
    hub('bmw', [
      [three, ['batteries']],
      [five, ['batteries', 'oil-filters']],
    ]),
    hub('mercedes-benz', [[eClass, ['oil-filters']]]),
  ];

  it('lists each make with the series whose series-category page the category has', () => {
    expect(categoryCars(hubs, 'oil-filters')).toEqual([
      { make: { slug: 'bmw', name: 'BMW' }, series: [five] },
      {
        make: { slug: 'mercedes-benz', name: 'Mercedes-Benz' },
        series: [eClass],
      },
    ]);
  });

  it('keeps the series in the order of the make page and leaves out a make with none', () => {
    expect(categoryCars(hubs, 'batteries')).toEqual([
      { make: { slug: 'bmw', name: 'BMW' }, series: [three, five] },
    ]);
  });

  it('offers no car for a category no series has a page in', () => {
    expect(categoryCars(hubs, 'body-parts')).toEqual([]);
  });
});
