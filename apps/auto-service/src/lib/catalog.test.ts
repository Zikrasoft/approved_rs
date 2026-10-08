import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CATALOG_LIMIT,
  createCatalogLoader,
  readCatalog,
  readStoreEnv,
} from './catalog';
import { typeView } from './typeView';
import {
  BATTERY,
  INSTALLATION,
  REGIONS,
  VERSION,
  battery,
  products,
} from './catalog.fixture';

const ENV = {
  backendUrl: 'http://localhost:9009',
  publishableKey: 'pk_test',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const store = (productsBody: unknown = products([BATTERY, INSTALLATION])) => {
  const calls: string[] = [];
  const fetcher = vi.fn(
    async (input: string | URL | Request, _init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      if (url.pathname === '/store/catalog-version') return json(VERSION);
      if (url.pathname === '/store/regions') return json(REGIONS);
      if (url.pathname === '/store/products') return json(productsBody);
      return json({ message: 'no' }, 404);
    },
  );
  return { fetcher: fetcher as unknown as typeof fetch, calls, spy: fetcher };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readCatalog', () => {
  it('turns a Store API product into a card with its RSD price, spec and fitment', () => {
    const { catalog, skipped } = readCatalog(products([BATTERY, INSTALLATION]));

    expect(skipped).toEqual([]);
    expect(catalog.products).toEqual([
      {
        id: BATTERY.id,
        handle: 'bosch-s4-024',
        type: typeView('batteries', 'ru').type,
        title: 'Bosch S4 024',
        description: BATTERY.description,
        image: BATTERY.thumbnail,
        spec: BATTERY.metadata.spec,
        fitment: BATTERY.metadata.fitment,
        variantId: 'variant_01M3NFC1VA4DD30F9DBKDBPSBJ',
        price: 11190,
        inStock: true,
      },
    ]);
    expect(catalog.installations).toEqual({
      'battery-installation': {
        handle: 'battery-installation',
        variantId: 'variant_01M3NFBYD4R1DVY0FKR0RJ08YB',
        price: 1500,
      },
    });
    expect(JSON.stringify(catalog)).not.toContain('Default');
  });

  it.each([
    ['no price in the region', { calculated_price: null }],
    [
      'a zero price',
      { calculated_price: { calculated_amount: 0, currency_code: 'rsd' } },
    ],
    [
      'a price in euros',
      { calculated_price: { calculated_amount: 90, currency_code: 'eur' } },
    ],
  ])('skips a product with %s and names it', (_label, variantPatch) => {
    const unpriced = battery('topla-energy-60');
    Object.assign(unpriced.variants[0], variantPatch);

    const { catalog, skipped } = readCatalog(products([BATTERY, unpriced]));

    expect(catalog.products.map((p) => p.handle)).toEqual(['bosch-s4-024']);
    expect(skipped).toEqual(['topla-energy-60: no RSD price']);
  });

  it('takes the only variant of an admin-made product that has no SKU', () => {
    const plain = battery('varta-e12');
    plain.variants[0].sku = null as unknown as string;

    const { catalog } = readCatalog(products([plain]));

    expect(catalog.products[0].variantId).toBe('variant_varta-e12');
  });

  it('never guesses between several variants without the handle SKU', () => {
    const multi = battery('exide-ea770');
    multi.variants = [
      { ...multi.variants[0], id: 'v1', sku: 'A' },
      { ...multi.variants[0], id: 'v2', sku: 'B' },
    ];

    const { skipped } = readCatalog(products([BATTERY, multi]));

    expect(skipped).toEqual(['exide-ea770: no variant with SKU EXIDE-EA770']);
  });

  it('marks a tracked product with no stock as out of stock, an untracked one as in stock', () => {
    const empty = battery('exide-agm-ek950');
    empty.variants[0].inventory_quantity = 0;
    const untracked = battery('moll-72');
    untracked.variants[0].manage_inventory = false;

    const { catalog } = readCatalog(products([empty, untracked]));

    expect(
      Object.fromEntries(catalog.products.map((p) => [p.handle, p.inStock])),
    ).toEqual({ 'exide-agm-ek950': false, 'moll-72': true });
  });

  it('sorts cards by price, cheapest first', () => {
    const cheap = battery('topla-energy-60');
    cheap.variants[0].calculated_price = {
      calculated_amount: 9090,
      currency_code: 'rsd',
    };

    const { catalog } = readCatalog(products([BATTERY, cheap]));

    expect(catalog.products.map((p) => p.price)).toEqual([9090, 11190]);
  });

  it('fails the build on a product whose attributes break the registry, naming it', () => {
    const broken = battery('bad-spec', {
      metadata: { spec: { brand: 'X' }, fitment: [] },
    });

    expect(() => readCatalog(products([broken]))).toThrow(/bad-spec/);
  });
});

describe('createCatalogLoader', () => {
  it('asks Medusa with the publishable key, the region and the Medusa locale', async () => {
    const { fetcher, spy } = store();
    await createCatalogLoader(ENV, fetcher).catalog('sr');

    const productCall = spy.mock.calls
      .map(([input, init]) => ({ url: new URL(String(input)), init }))
      .find(({ url }) => url.pathname === '/store/products')!;
    expect(productCall.url.searchParams.get('locale')).toBe('sr-RS');
    expect(productCall.url.searchParams.get('region_id')).toBe(
      REGIONS.regions[0].id,
    );
    expect(productCall.url.searchParams.get('limit')).toBe(
      String(CATALOG_LIMIT),
    );
    expect(productCall.init?.headers).toEqual({
      'x-publishable-api-key': 'pk_test',
    });
  });

  it('reads the catalog version before the products it bakes', async () => {
    const { fetcher, calls } = store();
    await createCatalogLoader(ENV, fetcher).catalog('ru');

    expect(calls.indexOf('/store/catalog-version')).toBeLessThan(
      calls.indexOf('/store/products'),
    );
  });

  it('asks once per locale, however many pages build', async () => {
    const { fetcher, calls } = store();
    const loader = createCatalogLoader(ENV, fetcher);

    await Promise.all([
      loader.catalog('sr'),
      loader.catalog('sr'),
      loader.catalog('en'),
    ]);

    expect(calls.filter((path) => path === '/store/products')).toHaveLength(2);
    expect(calls.filter((path) => path === '/store/regions')).toHaveLength(1);
  });

  it('fails the build when Medusa cannot be reached', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(
        new TypeError('fetch failed'),
      ) as unknown as typeof fetch;

    await expect(
      createCatalogLoader(ENV, fetcher).catalog('sr'),
    ).rejects.toThrow('fetch failed');
  });

  it('fails the build on an error answer, naming the route', async () => {
    const fetcher = vi.fn(async () => json({}, 503)) as unknown as typeof fetch;

    await expect(
      createCatalogLoader(ENV, fetcher).catalog('sr'),
    ).rejects.toThrow('Medusa answered 503 for /store/catalog-version');
  });

  it('fails the build on an empty catalog instead of shipping an empty shop', async () => {
    const { fetcher } = store(products([INSTALLATION]));

    await expect(
      createCatalogLoader(ENV, fetcher).catalog('sr'),
    ).rejects.toThrow('the catalog is empty');
  });

  it('fails the build when the store holds more products than one read returns', async () => {
    const { fetcher } = store(products([BATTERY], CATALOG_LIMIT + 1));

    await expect(
      createCatalogLoader(ENV, fetcher).catalog('sr'),
    ).rejects.toThrow(/add pagination/);
  });

  it('fails the build when Medusa returns fewer products than it counts', async () => {
    const { fetcher } = store(products([BATTERY, INSTALLATION], 3));

    await expect(
      createCatalogLoader(ENV, fetcher).catalog('sr'),
    ).rejects.toThrow(/reported 3 products but returned 2/);
  });

  it('fails the build on an unparsable answer, naming the route', async () => {
    const fetcher = vi.fn(async (input: string | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === '/store/products') return new Response('not json');
      if (path === '/store/regions') return json(REGIONS);
      return json(VERSION);
    }) as unknown as typeof fetch;

    await expect(
      createCatalogLoader(ENV, fetcher).catalog('sr'),
    ).rejects.toThrow('[catalog] bad answer from /store/products');
  });

  it('fails the build on a malformed products answer, naming the route', async () => {
    const { fetcher } = store({ products: [{ id: 'x' }], count: 1 });

    await expect(
      createCatalogLoader(ENV, fetcher).catalog('sr'),
    ).rejects.toThrow('[catalog] bad answer from /store/products');
  });

  it('fails the build when a variant is missing manage_inventory', async () => {
    const drifted = battery('no-inventory-flag');
    delete (drifted.variants[0] as Record<string, unknown>).manage_inventory;
    const { fetcher } = store(products([drifted]));

    await expect(
      createCatalogLoader(ENV, fetcher).catalog('sr'),
    ).rejects.toThrow('[catalog] bad answer from /store/products');
  });

  it('fails the build when no region sells in RSD', async () => {
    const fetcher = vi.fn(async (input: string | URL) =>
      new URL(String(input)).pathname === '/store/regions'
        ? json({ regions: [{ id: 'reg_eur', currency_code: 'eur' }] })
        : json(VERSION),
    ) as unknown as typeof fetch;

    await expect(createCatalogLoader(ENV, fetcher).regionId()).rejects.toThrow(
      /no RSD region/,
    );
  });
});

describe('readStoreEnv', () => {
  it('reads the public backend URL and key', () => {
    expect(
      readStoreEnv({
        PUBLIC_MEDUSA_BACKEND_URL: 'https://api.carlab.rs',
        PUBLIC_MEDUSA_PUBLISHABLE_KEY: 'pk_live',
      }),
    ).toEqual({
      backendUrl: 'https://api.carlab.rs',
      publishableKey: 'pk_live',
    });
  });

  it('fails loudly when the shop builds without them', () => {
    expect(() => readStoreEnv({})).toThrow();
    expect(() =>
      readStoreEnv({
        PUBLIC_MEDUSA_BACKEND_URL: 'api.carlab.rs',
        PUBLIC_MEDUSA_PUBLISHABLE_KEY: 'secret',
      }),
    ).toThrow();
  });
});
