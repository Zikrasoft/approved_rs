import { describe, expect, it } from 'vitest';
import type { CarHit } from '@podbor/catalog-contract';
import {
  carLink,
  exactPart,
  searchIntent,
  suggestionsFrom,
} from './catalogueSearch';

const make = { slug: 'bmw', name: 'BMW' };
const model = {
  slug: 'e83-x3-20d',
  name: 'X3 2.0d',
  chassis: {
    code: 'E83',
    body_style: 'suv' as const,
    series: { name: 'X3', translations: null, make },
  },
};
const vehicle = {
  id: 'veh_1',
  slug: 'n47-130kw',
  engine: { code: 'N47D20A' },
  power_kw: 130,
  year_from: 2007,
  year_to: 2010,
};

const result = (value: string, normalized: string, slug: string) => ({
  id: `pi_${slug}`,
  type: 'manufacturer-number',
  value,
  normalized_value: normalized,
  superseded: false,
  brand: { name: 'Mann-Filter', slug: 'mann-filter' },
  part: { id: `part_${slug}`, name: 'Масляный фильтр', category: null },
  offers: [],
  thumbnail: null,
  slug,
});

describe('searchIntent', () => {
  it('reads a VIN in any spelling', () => {
    expect(searchIntent('wba 35bg07-0n074158')).toEqual({
      kind: 'vin',
      vin: 'WBA35BG070N074158',
    });
  });

  it('reads anything else as a query', () => {
    expect(searchIntent('HU 816 x')).toEqual({ kind: 'query' });
  });
});

describe('exactPart', () => {
  const hu816 = result('HU 816 x', 'HU816X', 'mann-filter-hu816x');
  const oem = result('11 42 8575211', '11428575211', 'bmw-11428575211');

  it('opens the one number the query spells', () => {
    expect(exactPart('hu-816.x', [oem, hu816])).toBe('mann-filter-hu816x');
  });

  it('opens nothing for a name', () => {
    expect(exactPart('масляный фильтр', [hu816])).toBeNull();
  });

  it('opens nothing when two brands share the number', () => {
    const twin = { ...hu816, slug: 'febi-hu816x' };
    expect(exactPart('HU 816 x', [hu816, twin])).toBeNull();
  });
});

describe('carLink', () => {
  const hit = (kind: CarHit['kind']): CarHit => ({
    kind,
    make,
    model: kind === 'make' ? null : model,
    vehicle: kind === 'vehicle' ? vehicle : null,
  });

  it('links a Make to its page', () => {
    expect(carLink(hit('make'), 'ru')).toEqual({
      href: '/ru/parts/bmw/',
      label: 'BMW',
    });
  });

  it('links a Model to its page under its name', () => {
    expect(carLink(hit('model'), 'en')).toEqual({
      href: '/en/parts/bmw/e83-x3-20d/',
      label: 'BMW X3 E83 X3 2.0d',
    });
  });

  it('links a Vehicle to its page with its engine and years', () => {
    expect(carLink(hit('vehicle'), 'ru')).toEqual({
      href: '/ru/parts/bmw/e83-x3-20d/m/n47-130kw/',
      label: 'BMW X3 E83 X3 2.0d',
      detail: 'N47D20A, 130 кВт, 2007–2010',
    });
  });
});

describe('suggestionsFrom', () => {
  it('groups cars and part numbers into links', () => {
    expect(
      suggestionsFrom(
        {
          cars: [{ kind: 'make', make, model: null, vehicle: null }],
          results: [result('HU 816 x', 'HU816X', 'mann-filter-hu816x')],
        },
        'ru',
      ),
    ).toEqual({
      cars: [{ href: '/ru/parts/bmw/', label: 'BMW' }],
      parts: [
        {
          href: '/ru/parts/p/mann-filter-hu816x/',
          label: 'Mann-Filter HU 816 x',
          detail: 'Масляный фильтр',
          thumb: null,
        },
      ],
    });
  });
});
