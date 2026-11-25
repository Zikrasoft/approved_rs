import { describe, expect, it } from 'vitest';
import {
  seriesCategoryPagePath,
  seriesCategoryPageResponseSchema,
  seriesPagePath,
  seriesPageResponseSchema,
} from './seriesPageView.ts';

const series = {
  name: '3 Series',
  slug: '3-series',
  translations: null,
  make: { slug: 'bmw', name: 'BMW' },
};

const vehicle = {
  id: 'veh_1',
  slug: null,
  power_kw: 140,
  drive: 'rwd',
  market: null,
  year_from: 2015,
  year_to: null,
  steering: null,
  model: {
    slug: 'f30-320d',
    name: '320d',
    chassis: { code: 'F30', body_style: 'sedan', series },
  },
  engine: null,
  identifiers: [],
  requirements: [],
};

const category = {
  id: 'cat_1',
  slug: 'oil-filters',
  name: 'Oil filters',
  text: '',
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: null,
  service_price: null,
  service_note: null,
  image: null,
  fields: [],
};

const page = {
  id: 'pi_1',
  type: 'manufacturer-number',
  value: 'HU 816 x',
  normalized_value: 'HU816X',
  superseded: false,
  brand: { name: 'Mann-Filter', slug: 'mann-filter' },
  images: [],
  part: {
    id: 'part_1',
    name: 'Oil filter',
    translations: null,
    replaced_by: null,
    category_id: 'cat_1',
    attributes: {},
  },
  equivalents: [],
  offers: [],
  supplier_data: { cross_references: [], applicability: [], images: [] },
  slug: 'mann-filter-hu816x',
};

const hub = {
  series,
  models: [{ vehicles: [vehicle] }],
  categories: [category],
  popular: [page],
};

const fit = {
  part_id: 'part_1',
  vehicle_id: 'veh_1',
  axle: 'front',
  side: null,
  gearbox: null,
  steering: null,
};

const categoryPage = {
  series,
  category,
  parts: [{ pages: [page], fits: [fit] }],
  vehicles: [vehicle],
};

describe('seriesPageResponseSchema', () => {
  it('reads a Series hub and strips a key a newer shop adds', () => {
    const parsed = seriesPageResponseSchema.parse(hub);

    expect(seriesPageResponseSchema.parse({ ...hub, extra: 1 })).toEqual(
      parsed,
    );
    expect(parsed.series.slug).toBe('3-series');
    expect(parsed.popular[0].slug).toBe('mann-filter-hu816x');
  });

  it('reads a display value newer than the contract as null', () => {
    const newer = {
      ...hub,
      models: [
        {
          vehicles: [
            {
              ...vehicle,
              model: {
                ...vehicle.model,
                chassis: { ...vehicle.model.chassis, body_style: 'zeppelin' },
              },
            },
          ],
        },
      ],
    };

    expect(
      seriesPageResponseSchema.parse(newer).models[0].vehicles[0].model.chassis
        .body_style,
    ).toBeNull();
  });

  it('reads a shop that sends no popular parts as none', () => {
    const { popular: _popular, ...older } = hub;

    expect(seriesPageResponseSchema.parse(older).popular).toEqual([]);
  });
});

describe('seriesCategoryPageResponseSchema', () => {
  it('reads the parts of a Series Category with their fits', () => {
    const parsed = seriesCategoryPageResponseSchema.parse({
      ...categoryPage,
      extra: 1,
    });

    expect(parsed.parts[0].fits[0].axle).toBe('front');
    expect(parsed.parts[0].fits[0].quantity).toBe(1);
    expect(parsed.parts[0].fits[0].vehicle_id).toBe('veh_1');
    expect(parsed.vehicles[0].id).toBe('veh_1');
  });

  it('reads a shop that sends no vehicles as none', () => {
    const { vehicles: _vehicles, ...older } = categoryPage;

    expect(seriesCategoryPageResponseSchema.parse(older).vehicles).toEqual([]);
  });

  it('reads a part without fits as fitting nothing', () => {
    const parsed = seriesCategoryPageResponseSchema.parse({
      ...categoryPage,
      parts: [{ pages: [page] }],
    });

    expect(parsed.parts[0].fits).toEqual([]);
  });

  it('refuses an answer without its Category', () => {
    const { category: _category, ...broken } = categoryPage;

    expect(seriesCategoryPageResponseSchema.safeParse(broken).success).toBe(
      false,
    );
  });
});

describe('the Series page paths', () => {
  it('names the hub and the Category page', () => {
    expect(seriesPagePath('bmw', '3-series')).toBe(
      '/store/catalogue-pages/series/bmw/3-series',
    );
    expect(seriesCategoryPagePath('bmw', '3-series', 'oil-filters')).toBe(
      '/store/catalogue-pages/series/bmw/3-series/oil-filters',
    );
  });
});
