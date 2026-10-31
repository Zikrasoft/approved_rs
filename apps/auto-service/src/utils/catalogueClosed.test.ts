import { describe, expect, it, vi } from 'vitest';
import { createCatalogue } from './catalogue';
import { shopOpen } from './catalogueEnv';

const BACKEND_URL = 'http://shop.test';

const OFFERS = [
  {
    id: 'offer_1',
    price: 1850,
    currency: 'RSD',
    stock_quantity: 4,
    lead_time_days: 0,
  },
];

const bmw = { name: 'BMW', slug: 'bmw' };

const battery = {
  id: 'category_batteries',
  slug: 'batteries',
  name: 'Аккумуляторы',
  text: 'Аккумулятор.',
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: 'Регистрация аккумулятора',
  service_price: 2500,
  service_note: null,
  installation_price: 1500,
  image: null,
  fields: [],
};

const page = {
  id: 'pi_bmw',
  type: 'oem',
  value: '61 21 8 381 715',
  normalized_value: '61218381715',
  superseded: false,
  brand: bmw,
  images: [],
  part: {
    id: 'part_battery',
    name: 'Battery',
    translations: null,
    replaced_by: null,
    category_id: battery.id,
    attributes: {},
    installation_price: 0,
  },
  equivalents: [],
  offers: OFFERS,
  supplier_data: { cross_references: [], applicability: [], images: [] },
};

const found = {
  results: [
    {
      id: page.id,
      type: page.type,
      value: page.value,
      normalized_value: page.normalized_value,
      superseded: false,
      brand: bmw,
      part: { id: 'part_battery', name: 'Battery', category: null },
      offers: OFFERS,
      thumbnail: null,
    },
  ],
  facets: [
    {
      key: 'brand',
      type: 'single-select',
      label: 'brand',
      unit: null,
      values: [{ value: 'bmw', label: 'BMW', count: 1 }],
    },
    {
      key: 'price',
      type: 'number',
      label: 'price',
      unit: 'RSD',
      values: [{ value: '1850', label: '1850', count: 1 }],
    },
  ],
  category: null,
  model: null,
  count: 1,
  offset: 0,
  limit: 20,
};

const respond = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: async () => body });

const backend = () =>
  vi.fn((url: string) => {
    if (url.includes('/store/part-pages')) {
      return respond({ pages: [page], count: 1, offset: 0, limit: 1000 });
    }
    if (url.includes('/store/fitments')) {
      return respond({ fitments: [], count: 0, offset: 0, limit: 1000 });
    }
    if (url.endsWith('/store/categories')) {
      return respond({ categories: [battery] });
    }
    if (url.includes('/store/vehicles')) {
      return respond({ vehicles: [] });
    }
    if (url.endsWith('/store/catalogue-redirects')) {
      return respond({ redirects: [] });
    }
    if (url.includes('/store/search')) {
      return respond(found);
    }
    return respond({ offers: OFFERS });
  });

const PREVIEW_TOKEN = 'preview-token-0123456789abcdef0123';

const closed = (fetch: ReturnType<typeof vi.fn>, preview = false) =>
  createCatalogue({
    backendUrl: BACKEND_URL,
    publishableKey: 'pk_test',
    fetch: fetch as unknown as typeof globalThis.fetch,
    shopOpen: false,
    preview,
    previewToken: PREVIEW_TOKEN,
  });

describe('a closed shop', () => {
  it('builds part pages with no price and no add-on price', async () => {
    const [built] = await closed(backend()).partPages();

    expect(built.offers).toEqual([]);
    expect(built.priceOnRequest).toBe(true);
    expect(built.category?.service_price).toBeNull();
    expect(built.category?.installation_price).toBeNull();
    expect(built.part.installation_price).toBeNull();
    expect(built.category?.service_label).toBe('Регистрация аккумулятора');
  });

  it('lists Categories with no add-on price', async () => {
    const [category] = await closed(backend()).categories();

    expect(category.service_price).toBeNull();
    expect(category.installation_price).toBeNull();
  });

  it('searches with no price and no price filter', async () => {
    const result = await closed(backend()).search({
      q: 'battery',
      locale: 'ru',
      facets: [],
    });

    expect(result?.results[0].offers).toEqual([]);
    expect(result?.facets.map(({ key }) => key)).toEqual(['brand']);
  });

  it('quotes no live offer to a visitor without the preview flag', async () => {
    const fetch = backend();

    expect(await closed(fetch).liveOffers('pi_bmw')).toEqual({
      kind: 'inquiry',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows prices to a preview visitor and marks the backend requests', async () => {
    const fetch = backend();
    const preview = closed(fetch, true);

    expect(await preview.liveOffers('pi_bmw')).toEqual({
      kind: 'offers',
      offers: OFFERS,
    });
    expect((await preview.partPages())[0].offers).toEqual(OFFERS);
    expect(fetch).toHaveBeenCalledWith(
      `${BACKEND_URL}/store/part-identifiers/pi_bmw/offers`,
      expect.objectContaining({
        headers: {
          'x-publishable-api-key': 'pk_test',
          'x-shop-preview': PREVIEW_TOKEN,
        },
      }),
    );
  });

  it('asks for the offers of a whole listing in one request per hundred numbers', async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `pi_${index}`);
    const fetch = vi.fn((url: string) =>
      respond({
        offers: Object.fromEntries(
          new URL(url).searchParams
            .getAll('part_identifier_id')
            .map((id) => [id, id === 'pi_149' ? OFFERS : []]),
        ),
        installation: { pi_149: 0 },
      }),
    );

    const { offers, installation } = await closed(fetch, true).offersFor(ids);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(Object.keys(offers)).toHaveLength(150);
    expect(offers.pi_149).toEqual(OFFERS);
    expect(installation).toEqual({ pi_149: 0 });
    expect(await closed(fetch).offersFor(ids)).toEqual({
      offers: {},
      installation: {},
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('builds an open shop with prices even while the backend is still closed', async () => {
    const fetch = backend();

    await createCatalogue({
      backendUrl: BACKEND_URL,
      publishableKey: 'pk_test',
      fetch: fetch as unknown as typeof globalThis.fetch,
      shopOpen: true,
      previewToken: PREVIEW_TOKEN,
    }).categories();

    expect(fetch).toHaveBeenCalledWith(
      `${BACKEND_URL}/store/categories`,
      expect.objectContaining({
        headers: {
          'x-publishable-api-key': 'pk_test',
          'x-shop-preview': PREVIEW_TOKEN,
        },
      }),
    );
  });

  it('reads the shop as closed unless SHOP_OPEN is true', () => {
    expect(shopOpen({})).toBe(false);
    expect(shopOpen({ SHOP_OPEN: '' })).toBe(false);
    expect(shopOpen({ SHOP_OPEN: 'false' })).toBe(false);
    expect(shopOpen({ SHOP_OPEN: 'true' })).toBe(true);
  });
});
