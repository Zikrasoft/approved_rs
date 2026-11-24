import { describe, expect, it } from 'vitest';
import {
  CATALOGUE_LOCALE_HEADER,
  catalogueLocaleSchema,
  partPagePath,
  partPageResponseSchema,
} from './partPageView.ts';

const page = {
  id: 'pi_1',
  type: 'manufacturer-number',
  value: 'HU 816 x',
  normalized_value: 'HU816X',
  superseded: false,
  listed: true,
  brand: { name: 'Mann-Filter', slug: 'mann-filter' },
  images: [],
  part: {
    id: 'part_1',
    name: 'Oil filter',
    description: null,
    translations: null,
    replaced_by: null,
    category_id: null,
    attributes: {},
    installation_price: null,
  },
  equivalents: [],
  offers: [],
  supplier_data: { cross_references: [], applicability: [], images: [] },
  demand: null,
  slug: 'mann-filter-hu816x',
  category: null,
};

const fit = {
  part_id: 'part_1',
  vehicle_id: 'vehicle_1',
  quantity: 1,
  axle: 'front',
  side: null,
  production_from: null,
  production_to: null,
  gearbox: null,
  steering: null,
  note: null,
  translations: null,
  vehicle: {
    id: 'vehicle_1',
    slug: 'v1',
    power_kw: 100,
    drive: null,
    market: null,
    year_from: 2010,
    year_to: null,
    steering: null,
    model: {
      slug: 'golf',
      name: 'Golf',
      chassis: {
        code: '1K',
        body_style: null,
        series: {
          name: 'Golf',
          translations: null,
          make: { slug: 'vw', name: 'VW' },
        },
      },
    },
    engine: null,
    identifiers: [],
    requirements: [],
  },
};

const response = {
  page: {
    ...page,
    indexable: true,
    fits: [fit],
    requirement_cars: [],
    kit_cars: [],
  },
  related: [{ ...page, id: 'pi_2', slug: 'mann-filter-hu816y' }],
  linked_series: [{ make: 'vw', slug: 'golf' }],
};

describe('partPageResponseSchema', () => {
  it('reads a Part page and strips a key a newer shop adds', () => {
    const parsed = partPageResponseSchema.parse(response);

    expect(
      partPageResponseSchema.parse({ ...response, generated_at: 'now' }),
    ).toEqual(parsed);
    expect(parsed.page.fits[0].axle).toBe('front');
    expect(parsed.related[0].slug).toBe('mann-filter-hu816y');
    expect(parsed.linked_series).toEqual([{ make: 'vw', slug: 'golf' }]);
  });

  it('reads a display value newer than the contract as null', () => {
    const newer = {
      ...response,
      page: { ...response.page, fits: [{ ...fit, axle: 'middle' }] },
    };
    expect(partPageResponseSchema.parse(newer).page.fits[0].axle).toBeNull();
  });

  it('reads an older shop without resolved links or car lists as none', () => {
    const { linked_series: _linked, ...older } = response;
    const {
      requirement_cars: _requirement,
      kit_cars: _kit,
      ...olderPage
    } = response.page;
    const parsed = partPageResponseSchema.parse({ ...older, page: olderPage });

    expect(parsed.linked_series).toEqual([]);
    expect(parsed.page.requirement_cars).toEqual([]);
    expect(parsed.page.kit_cars).toEqual([]);
  });

  it('refuses an answer without its page', () => {
    const { page: _page, ...broken } = response;
    expect(partPageResponseSchema.safeParse(broken).success).toBe(false);
  });
});

describe('the catalogue page request', () => {
  it('names the Part page path by slug', () => {
    expect(partPagePath('mann-filter-hu816x')).toBe(
      '/store/catalogue-pages/parts/mann-filter-hu816x',
    );
  });

  it('carries the locale in a header and reads an unknown one as Russian', () => {
    expect(CATALOGUE_LOCALE_HEADER).toBe('x-catalogue-locale');
    expect(catalogueLocaleSchema.parse('sr')).toBe('sr');
    expect(catalogueLocaleSchema.parse('de')).toBe('ru');
    expect(catalogueLocaleSchema.parse(undefined)).toBe('ru');
  });
});
