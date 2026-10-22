import { describe, expect, it, vi } from 'vitest';
import {
  catalogueFromEnv,
  categoriesForBuild,
  categoryFacets,
  categoryPagesForBuild,
  carPagesForBuild,
  createCatalogue,
  makeHubsForBuild,
  partPagesForBuild,
} from './catalogue';
import { PathBuilder } from './paths';
import { sitemapFilter } from './sitemap';

const BACKEND_URL = 'http://localhost:9009';

const mann = { name: 'Mann-Filter', slug: 'mann-filter' };
const bmw = { name: 'BMW', slug: 'bmw' };
const oilPart = {
  id: 'part_oil',
  name: 'Oil filter',
  translations: null,
  replaced_by: null,
  category_id: null,
  attributes: {},
};

const oilFilterMann = {
  id: 'pi_mann',
  type: 'manufacturer-number',
  value: 'HU 816 x',
  normalized_value: 'HU816X',
  superseded: false,
  brand: mann,
  images: [],
  part: oilPart,
  equivalents: [
    {
      id: 'pi_bmw',
      type: 'oem',
      value: '11 42 8575211',
      normalized_value: '11428575211',
      superseded: false,
      brand: bmw,
      images: [],
    },
  ],
  offers: [],
  supplier_data: { cross_references: [], applicability: [], images: [] },
};

const oilFilterBmw = {
  id: 'pi_bmw',
  type: 'oem',
  value: '11 42 8575211',
  normalized_value: '11428575211',
  superseded: false,
  brand: bmw,
  images: [],
  part: oilPart,
  equivalents: [
    {
      id: 'pi_mann',
      type: 'manufacturer-number',
      value: 'HU 816 x',
      normalized_value: 'HU816X',
      superseded: false,
      brand: mann,
      images: [],
    },
  ],
  offers: [
    {
      id: 'offer_1',
      price: 1850,
      currency: 'RSD',
      stock_quantity: 4,
      lead_time_days: 0,
    },
  ],
  supplier_data: { cross_references: [], applicability: [], images: [] },
};

const VEHICLE = {
  id: 'veh_1',
  power_kw: 140,
  drive: 'rwd',
  market: 'EU',
  year_from: 2015,
  year_to: 2019,
  steering: 'left',
  model: {
    slug: 'f30-320d',
    name: '320d',
    chassis: {
      code: 'F30',
      body_style: 'sedan',
      series: {
        name: '3 серия',
        translations: { sr: 'Serija 3', en: '3 Series' },
        make: { slug: 'bmw', name: 'BMW' },
      },
    },
  },
  engine: {
    code: 'B47D20O0',
    family: 'B47',
    fuel: 'diesel',
    displacement_cc: 1995,
  },
  identifiers: [{ type: 'bmw-type-code', value: '35BG' }],
  requirements: [] as unknown[],
};

const respond = (body: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 503, json: async () => body });

const backend = ({
  pages = [] as unknown[],
  categories = [] as unknown[],
  fitments = [] as unknown[],
  vehicles = [] as unknown[],
} = {}) =>
  vi.fn((url: string) => {
    if (url.includes('/store/part-pages')) {
      return respond({ pages, count: pages.length, offset: 0, limit: 1000 });
    }
    if (url.includes('/store/fitments')) {
      return respond({
        fitments,
        count: fitments.length,
        offset: 0,
        limit: 1000,
      });
    }
    if (url.endsWith('/store/categories')) {
      return respond({ categories });
    }
    if (url.endsWith('/store/vehicles')) {
      return respond({ vehicles });
    }
    return respond({}, false);
  });

const catalogueWith = (fetch: ReturnType<typeof vi.fn>) =>
  createCatalogue({
    backendUrl: BACKEND_URL,
    publishableKey: 'pk_test',
    fetch: fetch as unknown as typeof globalThis.fetch,
  });

describe('catalogue.partPages', () => {
  it('lists a page per brand-number at the Brand slug and normalized number', async () => {
    const fetch = backend({ pages: [oilFilterMann, oilFilterBmw] });

    const pages = await catalogueWith(fetch).partPages();

    expect(pages.map((page) => page.slug)).toEqual([
      'mann-filter-hu816x',
      'bmw-11428575211',
    ]);
    expect(pages[0].equivalents).toEqual(oilFilterMann.equivalents);
    expect(fetch).toHaveBeenCalledWith(
      `${BACKEND_URL}/store/part-pages?offset=0&limit=1000`,
      expect.objectContaining({
        headers: { 'x-publishable-api-key': 'pk_test' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('asks for the price on a brand-number no supplier offers', async () => {
    const fetch = backend({ pages: [oilFilterMann, oilFilterBmw] });

    const pages = await catalogueWith(fetch).partPages();

    expect(pages.map((page) => [page.slug, page.priceOnRequest])).toEqual([
      ['mann-filter-hu816x', true],
      ['bmw-11428575211', false],
    ]);
  });

  it('pages through the backend until the count is reached', async () => {
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('part-pages?offset=0&limit=1000')) {
        return respond({
          pages: [oilFilterMann],
          count: 2,
          offset: 0,
          limit: 1,
        });
      }
      if (url.endsWith('part-pages?offset=1&limit=1000')) {
        return respond({
          pages: [oilFilterBmw],
          count: 2,
          offset: 1,
          limit: 1,
        });
      }
      return backend()(url);
    });

    const pages = await catalogueWith(fetch).partPages();

    expect(pages).toHaveLength(2);
  });

  it('builds one page when two identifiers share a Brand and number', async () => {
    const ean = { ...oilFilterMann, id: 'pi_ean', type: 'ean' };
    const fetch = backend({ pages: [oilFilterMann, ean] });

    const pages = await catalogueWith(fetch).partPages();

    expect(pages.map((page) => page.id)).toEqual(['pi_mann']);
  });

  it('fails the build on a non-ok answer', async () => {
    const fetch = vi.fn(() => respond({}, false));

    await expect(catalogueWith(fetch).partPages()).rejects.toThrow('503');
  });

  it('fails the build on a body that breaks the contract', async () => {
    const fetch = vi.fn(() =>
      respond({ pages: [{ id: 'x' }], count: 1, offset: 0, limit: 1000 }),
    );

    await expect(catalogueWith(fetch).partPages()).rejects.toThrow();
  });
});

describe('catalogue categories', () => {
  const oilFilters = {
    id: 'category_oil_filters',
    slug: 'oil-filters',
    name: 'Масляные фильтры',
    text: 'Фильтр очищает масло.',
    translations: { sr: { name: 'Filteri ulja' } },
    maintenance_kit: false,
    kit_rank: 0,
    service_label: null,
    service_price: null,
    service_note: null,
    image: null,
    fields: [
      {
        key: 'height',
        type: 'number',
        unit: 'mm',
        label: 'Высота',
        translations: null,
        required: false,
        facet: true,
        rank: 0,
        options: [],
      },
    ],
  };
  const cabinFilters = {
    ...oilFilters,
    id: 'category_cabin_filters',
    slug: 'cabin-filters',
    name: 'Салонные фильтры',
    fields: [],
  };
  const classified = {
    ...oilFilterMann,
    part: {
      ...oilPart,
      category_id: oilFilters.id,
      attributes: { height: 79 },
    },
  };
  const withCategories = (pages: unknown[]) =>
    backend({ pages, categories: [oilFilters, cabinFilters] });

  it('gives a classified page its Category with the field definitions', async () => {
    const [page] = await catalogueWith(
      withCategories([classified]),
    ).partPages();

    expect(page.category).toEqual(oilFilters);
    expect(page.part.attributes).toEqual({ height: 79 });
  });

  it('builds a page per Category with the brand-numbers in it', async () => {
    const categories = await catalogueWith(
      withCategories([classified, oilFilterBmw]),
    ).categoryPages();

    expect(
      categories.map(({ slug, pages }) => [
        slug,
        pages.map((page) => page.slug),
      ]),
    ).toEqual([
      ['oil-filters', ['mann-filter-hu816x']],
      ['cabin-filters', []],
    ]);
  });

  it('offers the filter values the Category pages carry, counted per brand-number', async () => {
    const numbered = (normalized_value: string, attributes: object) => ({
      ...classified,
      id: `pi_${normalized_value}`,
      normalized_value,
      part: { ...classified.part, id: `part_${normalized_value}`, attributes },
    });
    const [oil, cabin] = await catalogueWith(
      withCategories([
        numbered('TALL1', { height: 100 }),
        classified,
        numbered('TWIN1', { height: 79 }),
        numbered('BARE1', {}),
      ]),
    ).categoryPages();

    expect(categoryFacets(oil, 'ru')).toEqual([
      {
        key: 'height',
        type: 'number',
        label: 'Высота',
        unit: 'mm',
        values: [
          { value: '79', label: '79', count: 2 },
          { value: '100', label: '100', count: 1 },
        ],
      },
    ]);
    expect(categoryFacets(cabin, 'ru')).toEqual([]);
  });

  it('adds brand, availability and best price, and hides a value every page shares', async () => {
    const offer = (price: number, stock_quantity: number) => ({
      id: `offer_${price}`,
      price,
      currency: 'RSD',
      stock_quantity,
      lead_time_days: 1,
    });
    const numbered = (
      normalized_value: string,
      brand: { name: string; slug: string },
      offers: unknown[],
    ) => ({
      ...classified,
      id: `pi_${normalized_value}`,
      normalized_value,
      brand,
      offers,
      part: { ...classified.part, id: `part_${normalized_value}` },
    });
    const [oil] = await catalogueWith(
      withCategories([
        numbered('A1', mann, [offer(1200, 4), offer(900, 0)]),
        numbered('B1', bmw, [offer(2400, 0)]),
        numbered('C1', bmw, []),
      ]),
    ).categoryPages();

    expect(categoryFacets(oil, 'ru')).toEqual([
      {
        key: 'brand',
        type: 'single-select',
        label: 'brand',
        unit: null,
        values: [
          { value: 'bmw', label: 'BMW', count: 2 },
          { value: 'mann-filter', label: 'Mann-Filter', count: 1 },
        ],
      },
      {
        key: 'in-stock',
        type: 'boolean',
        label: 'in-stock',
        unit: null,
        values: [{ value: 'true', label: 'true', count: 1 }],
      },
      {
        key: 'price',
        type: 'number',
        label: 'price',
        unit: 'RSD',
        values: [
          { value: '1200', label: '1200', count: 2 },
          { value: '2400', label: '2400', count: 2 },
        ],
      },
    ]);
  });

  it('fails the build on a Category that breaks the contract', async () => {
    const fetch = vi.fn(() => respond({ categories: [{ id: 'x' }] }));

    await expect(catalogueWith(fetch).categories()).rejects.toThrow();
  });
});

const SITE = 'https://carlab.rs';

const category = (slug: string, name: string) => ({
  id: `category_${slug}`,
  slug,
  name,
  text: '',
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: null,
  service_price: null,
  service_note: null,
  image: null,
  fields: [] as unknown[],
});
const oilFilters = category('oil-filters', 'Масляные фильтры');
const brakePads = category('brake-pads', 'Тормозные колодки');

const fitment = (
  id: string,
  part_id: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  part_id,
  vehicle_id: VEHICLE.id,
  quantity: 1,
  axle: null,
  side: null,
  production_from: null,
  production_to: null,
  gearbox: null,
  steering: null,
  note: null,
  translations: null,
  ...overrides,
});

const brandNumber = (
  slug: string,
  number: string,
  part: Record<string, unknown>,
) => ({
  id: `pi_${slug}_${number}`,
  type: 'manufacturer-number',
  value: number,
  normalized_value: number,
  superseded: false,
  brand: { name: slug, slug },
  images: [],
  part: {
    translations: null,
    replaced_by: null,
    attributes: {},
    ...part,
  },
  equivalents: [],
  offers: [],
  supplier_data: { cross_references: [], applicability: [], images: [] },
});

describe('enriched part pages', () => {
  const classified = { ...oilPart, category_id: oilFilters.id };
  const pageWith = (
    part: Record<string, unknown>,
    equivalents: unknown[],
    fitments: unknown[],
  ) =>
    backend({
      pages: [{ ...oilFilterMann, part, equivalents }],
      categories: [oilFilters],
      fitments,
      vehicles: [VEHICLE],
    });

  it('indexes a page with a Category and a Fitment and lists it in the sitemap', async () => {
    const pages = await catalogueWith(
      pageWith(classified, [], [fitment('fit_1', oilPart.id)]),
    ).partPages();

    expect(pages[0].indexable).toBe(true);
    expect(
      sitemapFilter(
        SITE,
        pages,
      )(`${SITE}${PathBuilder.partNumber('sr', 'mann-filter-hu816x')}`),
    ).toBe(true);
  });

  it('indexes a page with a Category and a published equivalent', async () => {
    const [page] = await catalogueWith(
      pageWith(classified, oilFilterMann.equivalents, []),
    ).partPages();

    expect(page.indexable).toBe(true);
  });

  it('keeps a page with a Category but nothing else noindex and out of the sitemap', async () => {
    const pages = await catalogueWith(pageWith(classified, [], [])).partPages();

    expect(pages[0].indexable).toBe(false);
    expect(
      sitemapFilter(
        SITE,
        pages,
      )(`${SITE}${PathBuilder.partNumber('sr', 'mann-filter-hu816x')}`),
    ).toBe(false);
  });

  it('keeps a page without a Category noindex however much it fits', async () => {
    const pages = await catalogueWith(
      pageWith(oilPart, oilFilterMann.equivalents, [
        fitment('fit_1', oilPart.id),
      ]),
    ).partPages();

    expect(pages[0].indexable).toBe(false);
    expect(
      sitemapFilter(
        SITE,
        pages,
      )(`${SITE}${PathBuilder.partNumber('en', 'mann-filter-hu816x')}`),
    ).toBe(false);
  });

  it('lists the cars a part fits with quantity and position', async () => {
    const [page] = await catalogueWith(
      pageWith(
        classified,
        [],
        [fitment('fit_1', oilPart.id, { quantity: 2, axle: 'front' })],
      ),
    ).partPages();

    expect(page.fits).toEqual([
      expect.objectContaining({ quantity: 2, axle: 'front', vehicle: VEHICLE }),
    ]);
  });
});

describe('catalogue.carPages', () => {
  const frontPads = brandNumber('textar', '2512101', {
    id: 'part_front',
    name: 'Колодки передние',
    category_id: brakePads.id,
  });
  const rearPads = brandNumber('textar', '2512201', {
    id: 'part_rear',
    name: 'Колодки задние',
    category_id: brakePads.id,
  });
  const sportPads = brandNumber('textar', '2512301', {
    id: 'part_sport',
    name: 'Колодки передние, M Sport',
    category_id: brakePads.id,
  });
  const carPagesFor = (pages: unknown[], fitments: unknown[]) =>
    catalogueWith(
      backend({
        pages,
        categories: [brakePads],
        fitments,
        vehicles: [VEHICLE],
      }),
    ).carPages();

  it('lists parts per Category and position with the quantity', async () => {
    const [car] = await carPagesFor(
      [frontPads, rearPads],
      [
        fitment('fit_front', 'part_front', { axle: 'front', quantity: 2 }),
        fitment('fit_rear', 'part_rear', { axle: 'rear', quantity: 2 }),
      ],
    );

    expect(car.vehicle).toEqual(VEHICLE);
    expect(
      car.groups.map(({ category, axle, ambiguous, fitments }) => [
        category?.slug,
        axle,
        ambiguous,
        fitments.map(({ quantity, pages }) => [quantity, pages[0].slug]),
      ]),
    ).toEqual([
      ['brake-pads', 'front', false, [[2, 'textar-2512101']]],
      ['brake-pads', 'rear', false, [[2, 'textar-2512201']]],
    ]);
  });

  it('asks to confirm the variant when two parts share a position', async () => {
    const [car] = await carPagesFor(
      [frontPads, sportPads],
      [
        fitment('fit_front', 'part_front', { axle: 'front' }),
        fitment('fit_sport', 'part_sport', { axle: 'front' }),
      ],
    );

    expect(car.groups).toHaveLength(1);
    expect(car.groups[0].ambiguous).toBe(true);
  });

  it('drops a candidate the car steering rules out', async () => {
    const [car] = await carPagesFor(
      [frontPads, sportPads],
      [
        fitment('fit_front', 'part_front', { steering: 'left' }),
        fitment('fit_sport', 'part_sport', { steering: 'right' }),
      ],
    );

    expect(car.groups[0].ambiguous).toBe(false);
    expect(car.groups[0].fitments.map(({ part }) => part.id)).toEqual([
      'part_front',
    ]);
  });

  it('builds a car page with no parts while nothing fits it', async () => {
    const [car] = await carPagesFor([frontPads], []);

    expect(car.groups).toEqual([]);
  });
});

describe('catalogue.makeHubs', () => {
  const otherModel = {
    ...VEHICLE,
    id: 'veh_2',
    model: { ...VEHICLE.model, slug: 'g20-320d', name: '320d' },
  };
  const oilFilter = brandNumber('mann-filter', 'HU816X', {
    id: 'part_oil',
    name: 'Масляный фильтр',
    category_id: oilFilters.id,
  });

  it('builds a Model x Category page only for a Category with a match', async () => {
    const hubs = await catalogueWith(
      backend({
        pages: [oilFilter],
        categories: [oilFilters, brakePads],
        fitments: [fitment('fit_oil', 'part_oil')],
        vehicles: [VEHICLE, otherModel],
      }),
    ).makeHubs();

    expect(
      hubs.map(({ make, models }) => [
        make.slug,
        models.map(({ model, categories }) => [
          model.slug,
          categories.map(({ category, parts }) => [
            category.slug,
            parts.map(({ pages }) => pages.map(({ slug }) => slug)),
          ]),
        ]),
      ]),
    ).toEqual([
      [
        'bmw',
        [
          ['f30-320d', [['oil-filters', [['mann-filter-hu816x']]]]],
          ['g20-320d', []],
        ],
      ],
    ]);
  });

  it('keeps only the Model own cars among the fits on its pages', async () => {
    const hubs = await catalogueWith(
      backend({
        pages: [oilFilter],
        categories: [oilFilters],
        fitments: [
          fitment('fit_f30', 'part_oil'),
          fitment('fit_g20', 'part_oil', { vehicle_id: 'veh_2' }),
        ],
        vehicles: [VEHICLE, otherModel],
      }),
    ).makeHubs();

    const [f30, g20] = hubs[0].models;
    expect(f30.categories[0].parts[0].fits.map(({ id }) => id)).toEqual([
      'fit_f30',
    ]);
    expect(g20.categories[0].parts[0].fits.map(({ id }) => id)).toEqual([
      'fit_g20',
    ]);
  });

  it('builds no hubs when no backend is configured', async () => {
    expect(await makeHubsForBuild({})).toEqual([]);
    expect(await carPagesForBuild({})).toEqual([]);
  });
});

describe('partPagesForBuild', () => {
  it('builds no part pages when no backend is configured', async () => {
    expect(await partPagesForBuild({})).toEqual([]);
  });

  it('builds no Category pages when no backend is configured', async () => {
    expect(await categoryPagesForBuild({})).toEqual([]);
    expect(await categoriesForBuild({})).toEqual([]);
  });
});

const VIN = 'WBA35BG070N074158';

const answer = (body: unknown, ok = true) => vi.fn(() => respond(body, ok));

const catalog = (fetch: ReturnType<typeof vi.fn>) =>
  createCatalogue({
    backendUrl: 'http://shop.test',
    publishableKey: 'pk_test',
    timeoutMs: 50,
    fetch: fetch as unknown as typeof globalThis.fetch,
  });

describe('catalogue.vehicles', () => {
  it('lists the Vehicles the car pages are built from', async () => {
    const fetch = answer({ vehicles: [VEHICLE] });

    expect(await catalog(fetch).vehicles()).toEqual([VEHICLE]);
    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/vehicles',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-publishable-api-key': 'pk_test',
        }),
      }),
    );
  });

  it('fails the build when the backend answers with an error', async () => {
    await expect(catalog(answer({}, false)).vehicles()).rejects.toThrow(
      '/store/vehicles answered 503',
    );
  });

  it('fails the build on a body that breaks the contract', async () => {
    await expect(
      catalog(answer({ vehicles: [{ id: 'veh_1' }] })).vehicles(),
    ).rejects.toThrow();
  });
});

describe('catalogueFromEnv', () => {
  it('builds a catalogue for a configured backend', () => {
    expect(
      catalogueFromEnv({
        MEDUSA_BACKEND_URL: 'http://shop.test',
        MEDUSA_PUBLISHABLE_KEY: 'pk_test',
      }),
    ).not.toBeNull();
  });

  it('reads an empty backend URL as no backend', () => {
    expect(
      catalogueFromEnv({ MEDUSA_BACKEND_URL: '', MEDUSA_PUBLISHABLE_KEY: '' }),
    ).toBeNull();
  });

  it.each([
    ['without a publishable key', { MEDUSA_BACKEND_URL: 'http://shop.test' }],
    [
      'with a backend URL that is not a URL',
      { MEDUSA_BACKEND_URL: 'shop.test', MEDUSA_PUBLISHABLE_KEY: 'pk_test' },
    ],
  ])('refuses a backend configured %s', (_, env) => {
    expect(() => catalogueFromEnv(env)).toThrow();
  });
});

describe('catalogue.resolveVin', () => {
  it('lands on the car page for a resolved VIN', async () => {
    const fetch = answer({ resolved: true, vehicle: VEHICLE, facts: {} });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'vehicle',
      vehicle: VEHICLE,
      facts: {},
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/vin-lookups',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ vin: VIN }),
      }),
    );
  });

  it('falls back to the inquiry for an unresolved VIN', async () => {
    const fetch = answer({ resolved: false, make: 'bmw', code: '99ZZ' });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the backend answers with an error', async () => {
    expect(await catalog(answer({}, false)).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the body breaks the contract', async () => {
    const fetch = answer({ resolved: true, vehicle: { id: 'veh_1' } });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the backend is unreachable', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the backend does not answer in time', async () => {
    const fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    );

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });
});

describe('catalogue.search', () => {
  const found = {
    results: [
      {
        id: 'pi_mann',
        type: 'manufacturer-number',
        value: 'HU 816 x',
        normalized_value: 'HU816X',
        superseded: false,
        brand: mann,
        part: {
          id: 'part_oil',
          name: 'Filter ulja',
          category: { slug: 'oil-filters', name: 'Filteri za ulje' },
        },
        offers: [
          {
            id: 'offer_1',
            price: 1850,
            currency: 'RSD',
            stock_quantity: 3,
            lead_time_days: 0,
          },
        ],
        thumbnail: null,
      },
    ],
    facets: [
      {
        key: 'viscosity',
        type: 'single-select',
        label: 'Viskozitet',
        unit: null,
        values: [{ value: '5w-30', label: '5W-30', count: 1 }],
      },
    ],
    category: null,
    model: null,
    count: 1,
    offset: 0,
    limit: 20,
  };

  it('lists a Category without a text query', async () => {
    const fetch = answer(found);

    await catalog(fetch).search({
      category: 'engine-oil',
      locale: 'en',
      facets: ['viscosity:5w-30'],
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/search?locale=en&category=engine-oil&facets=viscosity%3A5w-30',
      expect.anything(),
    );
  });

  it('scopes a Category listing to one Model', async () => {
    const fetch = answer(found);

    await catalog(fetch).search({
      category: 'oil-filters',
      model: 'f30-320d',
      locale: 'ru',
      facets: [],
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/search?locale=ru&category=oil-filters&model=f30-320d',
      expect.anything(),
    );
  });

  it('sends the query, the page locale, the chosen facets and ranges', async () => {
    const fetch = answer(found);

    await catalog(fetch).search({
      q: 'filter ulja',
      locale: 'sr',
      facets: ['viscosity:5w-30', 'viscosity:0w-20'],
      ranges: [{ key: 'capacity', min: 70, max: null }],
      offset: 20,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/search?q=filter+ulja&locale=sr&facets=viscosity%3A5w-30&facets=viscosity%3A0w-20&range=capacity%3A70%3A&offset=20',
      expect.anything(),
    );
  });

  it('lists every match with a link slug to its brand-number page', async () => {
    const result = await catalog(answer(found)).search({
      q: 'hu816x',
      locale: 'sr',
      facets: [],
    });

    expect(result?.results.map(({ slug }) => slug)).toEqual([
      'mann-filter-hu816x',
    ]);
    expect(result?.facets).toEqual(found.facets);
  });

  it('gives no results when the backend answers with an error', async () => {
    expect(
      await catalog(answer({}, false)).search({
        q: 'x',
        locale: 'ru',
        facets: [],
      }),
    ).toBeNull();
  });

  it('gives no results on a body that breaks the contract', async () => {
    expect(
      await catalog(answer({ results: [{ id: 'pi_1' }] })).search({
        q: 'x',
        locale: 'ru',
        facets: [],
      }),
    ).toBeNull();
  });
});

describe('Requirements and the maintenance kit', () => {
  const engineOil = {
    ...category('engine-oil', 'Моторное масло'),
    maintenance_kit: true,
    kit_rank: 2,
  };
  const filters = { ...oilFilters, maintenance_kit: true, kit_rank: 1 };
  const approvedOil = brandNumber('liqui-moly', '20646', {
    id: 'part_ll04',
    name: 'Масло 5W-30 LL-04',
    category_id: engineOil.id,
    attributes: { approvals: ['bmw-ll-04', 'mb-229-51'] },
  });
  const otherOil = brandNumber('liqui-moly', '20800', {
    id: 'part_vw',
    name: 'Масло 5W-30 VW',
    category_id: engineOil.id,
    attributes: { approvals: ['vw-504-00'] },
  });
  const oilFilter = brandNumber('mann-filter', 'HU816X', {
    id: 'part_oil_filter',
    name: 'Масляный фильтр',
    category_id: filters.id,
  });
  const b47 = {
    ...VEHICLE,
    requirements: [
      {
        id: 'requirement_b47',
        category_id: engineOil.id,
        field_key: 'approvals',
        option_keys: ['bmw-ll-04'],
        min: null,
        max: null,
        quantity: 5,
      },
    ],
  };
  const withRequirements = (fitments: unknown[] = []) =>
    catalogueWith(
      backend({
        pages: [approvedOil, otherOil, oilFilter],
        categories: [filters, engineOil],
        fitments,
        vehicles: [b47],
      }),
    );

  it('offers the universal goods that meet the car Requirements', async () => {
    const [car] = await withRequirements().carPages();

    expect(
      car.matches.map(({ category, quantity, parts }) => [
        category.slug,
        quantity,
        parts.map(({ pages }) => pages[0].slug),
      ]),
    ).toEqual([['engine-oil', 5, ['liqui-moly-20646']]]);
  });

  it('assembles the kit from one Part per flagged Category with quantities', async () => {
    const [car] = await withRequirements([
      fitment('fit_filter', 'part_oil_filter'),
    ]).carPages();

    expect(
      car.kit.map(({ category, quantity, pages }) => [
        category.slug,
        quantity,
        pages[0].slug,
      ]),
    ).toEqual([
      ['oil-filters', 1, 'mann-filter-hu816x'],
      ['engine-oil', 5, 'liqui-moly-20646'],
    ]);
  });

  it('indexes a universal good a car Requirement matches, not one nothing asks for', async () => {
    const pages = await withRequirements().partPages();
    const indexable = (slug: string) =>
      pages.find((page) => page.slug === slug)?.indexable;

    expect(indexable('liqui-moly-20646')).toBe(true);
    expect(indexable('liqui-moly-20800')).toBe(false);
  });

  it('names on a page the cars its Requirements fit and the kits it is in', async () => {
    const pages = await withRequirements([
      fitment('fit_filter', 'part_oil_filter'),
    ]).partPages();
    const cars = (slug: string) => {
      const page = pages.find((candidate) => candidate.slug === slug);
      return [
        page?.requirementCars.map(({ id }) => id),
        page?.kitCars.map(({ id }) => id),
      ];
    };

    expect(cars('liqui-moly-20646')).toEqual([['veh_1'], ['veh_1']]);
    expect(cars('liqui-moly-20800')).toEqual([[], []]);
    expect(cars('mann-filter-hu816x')).toEqual([[], ['veh_1']]);
  });

  it('builds a Model x Category page for a Requirement match alone', async () => {
    const [hub] = await withRequirements().makeHubs();

    expect(
      hub.models[0].categories.map(({ category, parts }) => [
        category.slug,
        parts.map(({ pages, fits }) => [pages[0].slug, fits]),
      ]),
    ).toEqual([['engine-oil', [['liqui-moly-20646', []]]]]);
  });
});
