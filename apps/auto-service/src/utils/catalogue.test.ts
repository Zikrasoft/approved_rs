import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCatalogue } from './catalogue';
import {
  PREVIOUS_BUILD_URL,
  type CatalogueEnv,
  catalogueFromEnv,
  categoriesForBuild,
  categoryPagesForBuild,
  carPagesForBuild,
  makeHubsForBuild,
  partPagesForBuild,
} from './catalogueEnv';
import { categoryFacets } from './categoryFacets';
import {
  cataloguePagesFrom,
  categoryListings,
  makeHubsFrom,
} from './catalogueSnapshot';
import { fitGroups } from './fitGroups';
import { catalogueLinks, PathBuilder } from './paths';
import { sitemapFilter } from './sitemap';
import { GET as recordBuild } from '../pages/catalogue-build.json.ts';

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
  slug: 'b47d20o0-140kw',
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
  redirects = [] as unknown[],
} = {}) =>
  vi.fn((url: string) => {
    if (url.endsWith('/store/catalogue-redirects')) {
      return respond({ redirects });
    }
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
        headers: { 'x-publishable-api-key': 'pk_test', 'x-shop-preview': '1' },
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
    installation_price: null,
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

  it('leaves out of a Category a superseded number whose current number is listed', async () => {
    const part = { ...classified.part };
    const current = { ...oilFilterBmw, part };
    const retired = {
      ...oilFilterBmw,
      id: 'pi_bmw_old',
      value: '11 42 8507683',
      normalized_value: '11428507683',
      superseded: true,
      part,
      equivalents: [{ ...oilFilterBmw.equivalents[0] }, { ...current }],
      offers: [],
    };
    const orphan = {
      ...retired,
      id: 'pi_bmw_orphan',
      normalized_value: '11420000000',
      equivalents: [],
    };
    const [oil] = await catalogueWith(
      withCategories([retired, current, orphan]),
    ).categoryPages();

    expect(oil.pages.map((page) => page.slug)).toEqual([
      'bmw-11428575211',
      'bmw-11420000000',
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

const brandNumber = <Part extends Record<string, unknown>>(
  slug: string,
  number: string,
  part: Part,
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

  const listed = (pages: { slug: string; indexable: boolean }[]) =>
    sitemapFilter(
      SITE,
      pages,
    )(`${SITE}${PathBuilder.partNumber('sr', 'mann-filter-hu816x')}`);

  it.each<[string, Record<string, unknown>, unknown[], unknown[]]>([
    [
      'a description',
      { ...oilPart, description: 'Фильтр с обратным клапаном' },
      [],
      [],
    ],
    ['an attribute', { ...oilPart, attributes: { height: 79 } }, [], []],
    ['a Fitment', oilPart, [], [fitment('fit_1', oilPart.id)]],
    ['a published equivalent', oilPart, oilFilterMann.equivalents, []],
    [
      'a Category and a Fitment',
      classified,
      [],
      [fitment('fit_1', oilPart.id)],
    ],
  ])(
    'indexes a page with %s and lists it in the sitemap',
    async (_, part, equivalents, fitments) => {
      const pages = await catalogueWith(
        pageWith(part, equivalents, fitments),
      ).partPages();

      expect(pages[0].indexable).toBe(true);
      expect(listed(pages)).toBe(true);
    },
  );

  it.each([
    ['a bare page', oilPart],
    ['a page with only a Category', classified],
  ])('keeps %s noindex and out of the sitemap', async (_, part) => {
    const pages = await catalogueWith(pageWith(part, [], [])).partPages();

    expect(pages[0].indexable).toBe(false);
    expect(listed(pages)).toBe(false);
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

describe('Category listing pages', () => {
  const numbers = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      brandNumber('mann-filter', `HU${String(index).padStart(3, '0')}`, {
        id: `part_${index}`,
        name: 'Масляный фильтр',
        category_id: oilFilters.id,
      }),
    );
  const listingsOf = async (count: number) => {
    const [category] = await catalogueWith(
      backend({ pages: numbers(count), categories: [oilFilters] }),
    ).categoryPages();
    return categoryListings(category).map(({ number, count, pages }) => ({
      number,
      count,
      first: pages[0]?.value,
      size: pages.length,
    }));
  };

  it('splits a Category into pages of 48 brand-numbers', async () => {
    expect(await listingsOf(97)).toEqual([
      { number: 1, count: 3, first: 'HU000', size: 48 },
      { number: 2, count: 3, first: 'HU048', size: 48 },
      { number: 3, count: 3, first: 'HU096', size: 1 },
    ]);
  });

  it('keeps one page for a Category of 48', async () => {
    expect(await listingsOf(48)).toEqual([
      { number: 1, count: 1, first: 'HU000', size: 48 },
    ]);
  });

  it('keeps the first page for an empty Category', async () => {
    expect(await listingsOf(0)).toEqual([
      { number: 1, count: 1, first: undefined, size: 0 },
    ]);
  });

  it('lists every page of a Category in the sitemap', () => {
    const keep = sitemapFilter(SITE);
    expect(
      keep(`${SITE}${PathBuilder.partsCategory('sr', 'oil-filters', 2)}`),
    ).toBe(true);
  });
});

describe('a part page groups its Fitments', () => {
  const variant = { ...VEHICLE, id: 'veh_1b', power_kw: 120 };
  const g20 = {
    ...VEHICLE,
    id: 'veh_g20',
    model: {
      ...VEHICLE.model,
      slug: 'g20-320d',
      chassis: { ...VEHICLE.model.chassis, code: 'G20' },
    },
  };
  const a4 = {
    ...VEHICLE,
    id: 'veh_a4',
    model: {
      slug: 'b9-a4',
      name: 'A4 2.0 TDI',
      chassis: {
        code: 'B9',
        body_style: 'sedan',
        series: {
          name: 'A4',
          translations: null,
          make: { slug: 'audi', name: 'Audi' },
        },
      },
    },
  };

  it('by Make and Model, makes and models in name order', async () => {
    const [page] = await catalogueWith(
      backend({
        pages: [oilFilterMann],
        fitments: [
          fitment('fit_g20', oilPart.id, { vehicle_id: g20.id }),
          fitment('fit_f30', oilPart.id),
          fitment('fit_a4', oilPart.id, { vehicle_id: a4.id }),
          fitment('fit_f30b', oilPart.id, { vehicle_id: variant.id }),
        ],
        vehicles: [VEHICLE, variant, g20, a4],
      }),
    ).partPages();

    expect(
      fitGroups(page.fits).map(({ make, models }) => [
        make.slug,
        models.map(({ model, fits }) => [model.slug, fits.map(({ id }) => id)]),
      ]),
    ).toEqual([
      ['audi', [['b9-a4', ['fit_a4']]]],
      [
        'bmw',
        [
          ['f30-320d', ['fit_f30', 'fit_f30b']],
          ['g20-320d', ['fit_g20']],
        ],
      ],
    ]);
  });

  it('into nothing when the part fits no car', () => {
    expect(fitGroups([])).toEqual([]);
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
    )
      .snapshot()
      .then(({ cars }) => cars);

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

  it('leaves out a replaced Part once its successor is in the catalogue', async () => {
    const replaced = {
      ...frontPads,
      part: {
        ...frontPads.part,
        replaced_by: {
          id: 'part_sport',
          name: 'Колодки передние, M Sport',
          translations: null,
          brand_number: { ...sportPads, part: undefined },
        },
      },
    };
    const [car] = await carPagesFor(
      [replaced, sportPads],
      [
        fitment('fit_front', 'part_front', { axle: 'front' }),
        fitment('fit_sport', 'part_sport', { axle: 'front' }),
      ],
    );

    expect(car.groups[0].ambiguous).toBe(false);
    expect(car.groups[0].fitments.map(({ part }) => part.id)).toEqual([
      'part_sport',
    ]);
  });
});

describe('which catalogue places get a page', () => {
  const filters = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) =>
      brandNumber('mann-filter', `${prefix}${index}`, {
        id: `part_${prefix}${index}`,
        name: 'Масляный фильтр',
        category_id: oilFilters.id,
      }),
    );
  const modelOf = (slug: string, make = VEHICLE.model.chassis.series.make) => ({
    ...VEHICLE.model,
    slug,
    chassis: {
      ...VEHICLE.model.chassis,
      series: { ...VEHICLE.model.chassis.series, make },
    },
  });
  const car = (id: string, model = VEHICLE.model) => ({
    ...VEHICLE,
    id,
    slug: `${id}-kw`,
    model,
  });
  const fitting = (
    vehicle: { id: string },
    pages: { part: { id: string } }[],
  ) =>
    pages.map(({ part }) =>
      fitment(`fit_${vehicle.id}_${part.id}`, part.id, {
        vehicle_id: vehicle.id,
      }),
    );
  const shopOf = (pages: unknown[], vehicles: unknown[], fitments: unknown[]) =>
    catalogueWith(
      backend({ pages, categories: [oilFilters], fitments, vehicles }),
    );

  it('gives a Model a page from three distinct fitted Parts, counted across its Vehicles', async () => {
    const three = filters('A', 3);
    const two = filters('B', 2);
    const f30a = car('veh_f30a');
    const f30b = car('veh_f30b');
    const g20 = car('veh_g20', modelOf('g20-320d'));
    const hubs = await shopOf(
      [...three, ...two],
      [f30a, f30b, g20],
      [
        ...fitting(f30a, three.slice(0, 2)),
        ...fitting(f30b, three.slice(1)),
        ...fitting(g20, two),
      ],
    ).makeHubs();

    expect(
      hubs.map(({ make, models }) => [
        make.slug,
        models.map(({ model }) => model.slug),
      ]),
    ).toEqual([['bmw', ['f30-320d']]]);
  });

  it('gives a Vehicle a page only beside another Vehicle of its Model that has one', async () => {
    const parts = filters('C', 3);
    const f30a = car('veh_f30a');
    const f30b = car('veh_f30b');
    const f30thin = car('veh_f30thin');
    const g20 = car('veh_g20', modelOf('g20-320d'));
    const shop = shopOf(
      parts,
      [f30a, f30b, f30thin, g20],
      [
        ...fitting(f30a, parts),
        ...fitting(f30b, parts),
        ...fitting(f30thin, parts.slice(0, 2)),
        ...fitting(g20, parts),
      ],
    );

    expect((await shop.carPages()).map(({ vehicle }) => vehicle.id)).toEqual([
      'veh_f30a',
      'veh_f30b',
    ]);
    expect(
      (await shop.makeHubs())[0].models.map(({ model }) => model.slug),
    ).toEqual(['f30-320d', 'g20-320d']);
  });

  it('links a Model or a Vehicle only where its page exists', async () => {
    const parts = filters('E', 3);
    const f30a = car('veh_f30a');
    const f30b = car('veh_f30b');
    const f30thin = car('veh_f30thin');
    const g20 = car('veh_g20', modelOf('g20-320d'));
    const e90 = car('veh_e90', modelOf('e90-320d'));
    const links = catalogueLinks(
      'sr',
      cataloguePagesFrom(
        await shopOf(
          parts,
          [f30a, f30b, f30thin, g20, e90],
          [
            ...fitting(f30a, parts),
            ...fitting(f30b, parts),
            ...fitting(f30thin, parts.slice(0, 1)),
            ...fitting(g20, parts),
          ],
        ).snapshot(),
      ),
    );

    expect(links.model(f30a.model)).toBe('/sr/parts/bmw/f30-320d/');
    expect(links.model(e90.model)).toBeNull();
    expect(links.vehicle(f30a)).toBe('/sr/parts/bmw/f30-320d/m/veh_f30a-kw/');
    expect(links.vehicle(f30thin)).toBeNull();
    expect(links.vehicle(g20)).toBeNull();
  });

  it('keeps a Make without a Model page off, and names the rest in display-name order', async () => {
    const parts = filters('D', 3);
    const audi = { slug: 'audi', name: 'Audi' };
    const mini = { slug: 'mini', name: 'MINI' };
    const bmwCar = car('veh_bmw');
    const audiCar = car('veh_audi', modelOf('b9-a4', audi));
    const miniCar = car('veh_mini', modelOf('f56-cooper', mini));
    const hubs = await shopOf(
      parts,
      [bmwCar, miniCar, audiCar],
      [
        ...fitting(bmwCar, parts),
        ...fitting(audiCar, parts),
        ...fitting(miniCar, parts.slice(0, 1)),
      ],
    ).makeHubs();

    expect(hubs.map(({ make }) => make.slug)).toEqual(['audi', 'bmw']);
  });
});

describe('catalogue.makeHubs', () => {
  const otherModel = {
    ...VEHICLE,
    id: 'veh_2',
    model: { ...VEHICLE.model, slug: 'g20-320d', name: '320d' },
  };
  const oilFilter = (number: string) =>
    brandNumber('mann-filter', number, {
      id: `part_${number}`,
      name: 'Масляный фильтр',
      category_id: oilFilters.id,
    });
  const filters = ['HU816X', 'HU7020Z', 'HU6004X'].map(oilFilter);
  const fittingAll = (vehicleId: string) =>
    filters.map(({ part }) =>
      fitment(`fit_${vehicleId}_${part.id}`, part.id, {
        vehicle_id: vehicleId,
      }),
    );

  it('builds a Model x Category page only for a Category with a match', async () => {
    const hubs = await catalogueWith(
      backend({
        pages: filters,
        categories: [oilFilters, brakePads],
        fitments: fittingAll(VEHICLE.id),
        vehicles: [VEHICLE],
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
          [
            'f30-320d',
            [
              [
                'oil-filters',
                [
                  ['mann-filter-hu816x'],
                  ['mann-filter-hu7020z'],
                  ['mann-filter-hu6004x'],
                ],
              ],
            ],
          ],
        ],
      ],
    ]);
  });

  it('keeps only the Model own cars among the fits on its pages', async () => {
    const hubs = await catalogueWith(
      backend({
        pages: filters,
        categories: [oilFilters],
        fitments: [...fittingAll(VEHICLE.id), ...fittingAll('veh_2')],
        vehicles: [VEHICLE, otherModel],
      }),
    ).makeHubs();

    const [f30, g20] = hubs[0].models;
    expect(f30.categories[0].parts[0].fits.map(({ id }) => id)).toEqual([
      'fit_veh_1_part_HU816X',
    ]);
    expect(g20.categories[0].parts[0].fits.map(({ id }) => id)).toEqual([
      'fit_veh_2_part_HU816X',
    ]);
  });

  it('assembles the hubs once per catalogue snapshot', async () => {
    const snapshot = await catalogueWith(
      backend({
        pages: filters,
        categories: [oilFilters],
        fitments: fittingAll(VEHICLE.id),
        vehicles: [VEHICLE],
      }),
    ).snapshot();

    expect(makeHubsFrom(snapshot)).toBe(makeHubsFrom(snapshot));
  });

  it('builds no hubs when no backend is configured', async () => {
    expect(await makeHubsForBuild({})).toEqual([]);
    expect(await carPagesForBuild({})).toEqual([]);
  });
});

describe('catalogue redirects', () => {
  const renamed = {
    from: { make: 'bmw-old' },
    to: { make: 'bmw' },
  };

  it('reads the redirect list with the rest of the catalogue', async () => {
    const { redirects } = await catalogueWith(
      backend({ redirects: [renamed] }),
    ).snapshot();

    expect(redirects).toEqual([
      {
        from: expect.objectContaining({ make: 'bmw-old', model: null }),
        to: expect.objectContaining({ make: 'bmw', model: null }),
      },
    ]);
  });

  it('builds without redirects from a shop that has no redirect list yet, and fails on a shop error', async () => {
    const answering = (status: number) =>
      vi.fn((url: string) =>
        url.endsWith('/store/catalogue-redirects')
          ? Promise.resolve({ ok: false, status, json: async () => ({}) })
          : backend()(url),
      );

    expect((await catalogueWith(answering(404)).snapshot()).redirects).toEqual(
      [],
    );
    await expect(catalogueWith(answering(503)).snapshot()).rejects.toThrow(
      '503',
    );
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

describe('the deploy build', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  let shops = 0;
  const shopEnv = (env: CatalogueEnv = {}): CatalogueEnv => ({
    MEDUSA_BACKEND_URL: `http://shop-${++shops}.test`,
    MEDUSA_PUBLISHABLE_KEY: 'pk_test',
    ...env,
  });
  const partPages = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      ...oilFilterMann,
      id: `pi_${index}`,
      normalized_value: `HU${index}`,
    }));
  const deployed = (
    previous: number | null,
    shop: ReturnType<typeof backend> = backend(),
  ) =>
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === PREVIOUS_BUILD_URL
          ? previous === null
            ? Promise.resolve({
                ok: false,
                status: 404,
                json: async () => ({}),
              })
            : respond({ partPages: previous })
          : shop(url),
      ),
    );

  it('reads the catalogue once for every page, the sitemap and llms.txt', async () => {
    const shop = backend({ pages: partPages(2) });
    deployed(2, shop);
    const env = shopEnv({ VERCEL: '1' });

    await partPagesForBuild(env);
    await categoriesForBuild(env);
    await categoryPagesForBuild(env);
    await carPagesForBuild(env);
    await makeHubsForBuild(env);

    const reads = (path: string) =>
      shop.mock.calls.filter(([url]) => url.includes(path)).length;
    expect(reads('/store/part-pages')).toBe(1);
    expect(reads('/store/categories')).toBe(1);
  });

  it('fails without the backend URL once the live site has part pages', async () => {
    deployed(120);

    await expect(partPagesForBuild({ VERCEL: '1' })).rejects.toThrow(
      'MEDUSA_BACKEND_URL',
    );
  });

  it('builds without a catalogue while the live site has none', async () => {
    deployed(null);

    expect(await partPagesForBuild({ VERCEL: '1' })).toEqual([]);
  });

  it('fails on a shop with no part pages once the catalogue is live, even when shrinking is allowed', async () => {
    deployed(120, backend());

    await expect(
      partPagesForBuild(
        shopEnv({ VERCEL: '1', CATALOGUE_SHRINK_ALLOWED: 'true' }),
      ),
    ).rejects.toThrow('0 part pages');
  });

  it('fails on far fewer part pages than the live site has', async () => {
    deployed(10, backend({ pages: partPages(4) }));

    await expect(partPagesForBuild(shopEnv({ VERCEL: '1' }))).rejects.toThrow(
      '4 part pages',
    );
  });

  it('builds a catalogue that shrank by less than half', async () => {
    deployed(10, backend({ pages: partPages(6) }));

    expect(await partPagesForBuild(shopEnv({ VERCEL: '1' }))).toHaveLength(6);
  });

  it('builds a shrunken catalogue the owner allowed', async () => {
    deployed(10, backend({ pages: partPages(4) }));

    expect(
      await partPagesForBuild(
        shopEnv({ VERCEL: '1', CATALOGUE_SHRINK_ALLOWED: 'true' }),
      ),
    ).toHaveLength(4);
  });

  it('never asks the live site outside a deploy build', async () => {
    const shop = backend();
    deployed(120, shop);

    expect(await partPagesForBuild(shopEnv())).toEqual([]);
    expect(shop).toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      PREVIOUS_BUILD_URL,
      expect.anything(),
    );
  });

  it('fails when the live site cannot say what it serves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => respond({}, false)),
    );

    await expect(partPagesForBuild(shopEnv({ VERCEL: '1' }))).rejects.toThrow(
      '503',
    );
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

  it('asks for a few matches and the cars when suggesting', async () => {
    const car = {
      kind: 'make',
      make: { slug: 'bmw', name: 'BMW' },
      model: null,
      vehicle: null,
    };
    const fetch = answer({ ...found, cars: [car] });

    const suggested = await catalog(fetch).search({
      q: 'bmw',
      locale: 'ru',
      facets: [],
      limit: 5,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/search?q=bmw&locale=ru&limit=5',
      expect.anything(),
    );
    expect(suggested?.cars).toEqual([car]);
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

  it('gives no results on a body that breaks the contract, and says why', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await catalog(answer({ results: [{ id: 'pi_1' }] })).search({
        q: 'x',
        locale: 'ru',
        facets: [],
      }),
    ).toBeNull();
    expect(log).toHaveBeenCalledWith(
      'catalogue search failed',
      expect.stringContaining('results'),
    );
    log.mockRestore();
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
    const [car] = (await withRequirements().snapshot()).cars;

    expect(
      car.matches.map(({ category, quantity, parts }) => [
        category.slug,
        quantity,
        parts.map(({ pages }) => pages[0].slug),
      ]),
    ).toEqual([['engine-oil', 5, ['liqui-moly-20646']]]);
  });

  it('assembles the kit from one Part per flagged Category with quantities', async () => {
    const [car] = (
      await withRequirements([
        fitment('fit_filter', 'part_oil_filter'),
      ]).snapshot()
    ).cars;

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
    const fitted = [
      oilFilter,
      ...['HU7020Z', 'HU6004X'].map((number) =>
        brandNumber('mann-filter', number, {
          id: `part_${number}`,
          name: 'Масляный фильтр',
          category_id: filters.id,
        }),
      ),
    ];
    const [hub] = await catalogueWith(
      backend({
        pages: [approvedOil, otherOil, ...fitted],
        categories: [filters, engineOil],
        fitments: fitted.map(({ part }) => fitment(`fit_${part.id}`, part.id)),
        vehicles: [b47],
      }),
    ).makeHubs();

    expect(
      hub.models[0].categories.map(({ category, parts }) => [
        category.slug,
        parts.map(({ pages, fits }) => [pages[0].slug, fits.length]),
      ]),
    ).toEqual([
      [
        'oil-filters',
        [
          ['mann-filter-hu816x', 1],
          ['mann-filter-hu7020z', 1],
          ['mann-filter-hu6004x', 1],
        ],
      ],
      ['engine-oil', [['liqui-moly-20646', 0]]],
    ]);
  });
});

describe('catalogue.listingScope', () => {
  it('names the Category and Model a filtered listing belongs to', async () => {
    const scope = await catalogueWith(
      backend({
        categories: [
          { ...oilFilters, translations: { sr: { name: 'Filteri ulja' } } },
        ],
        vehicles: [VEHICLE],
      }),
    ).listingScope({ category: 'oil-filters', model: 'f30-320d' }, 'sr');

    expect(scope).toEqual({
      category: { slug: 'oil-filters', name: 'Filteri ulja' },
      model: VEHICLE.model,
    });
  });

  it('names nothing when the backend cannot answer', async () => {
    const scope = await catalogueWith(
      vi.fn(() => respond({}, false)),
    ).listingScope({ category: 'oil-filters' }, 'ru');

    expect(scope).toEqual({ category: null, model: null });
  });
});

describe('the build record', () => {
  it('tells the next build how many part pages this one serves', async () => {
    const response = await recordBuild({} as Parameters<typeof recordBuild>[0]);

    expect(await response.json()).toEqual({ partPages: 0 });
  });
});
