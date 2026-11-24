import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATALOGUE_TIMEOUT_MS, createCatalogue } from './catalogue';
import {
  DEV_BUILD_FRESH_MS,
  BUILD_CATALOGUE_TIMEOUT_MS,
  PREVIOUS_BUILD_URL,
  type CatalogueEnv,
  catalogueFromEnv,
  shopBackendUrl,
  categoriesForBuild,
  pageListForBuild,
  writeCatalogueMakes,
} from './catalogueEnv';
import { GET as recordBuild } from '../pages/catalogue-build.json.ts';

const BACKEND_URL = 'http://localhost:9009';

const mann = { name: 'Mann-Filter', slug: 'mann-filter' };

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
        translations: { sr: { name: 'Serija 3' }, en: { name: '3 Series' } },
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
  categories = [] as unknown[],
  vehicles = [] as unknown[],
  makes = undefined as unknown[] | undefined,
  list = undefined as unknown,
} = {}) =>
  vi.fn((url: string) => {
    if (url.endsWith('/store/catalogue-pages')) {
      return respond(
        list ?? {
          parts: [],
          makes: [],
          series: [],
          categories: [],
          catalogue_makes: makes ?? null,
        },
      );
    }
    if (url.endsWith('/store/categories')) {
      return respond({ categories });
    }
    if (url.includes('/store/vehicles')) {
      return respond({
        vehicles,
        count: vehicles.length,
        offset: 0,
        limit: 1000,
      });
    }
    return respond({}, false);
  });

const catalogueWith = (fetch: ReturnType<typeof vi.fn>) =>
  createCatalogue({
    backendUrl: BACKEND_URL,
    publishableKey: 'pk_test',
    fetch: fetch as unknown as typeof globalThis.fetch,
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
  const listOf = (count: number) => ({
    parts: Array.from({ length: count }, (_, index) => ({
      slug: `mann-filter-hu${index}`,
      indexable: true,
    })),
    makes: [],
    series: [],
    categories: [],
  });
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

  it('gives the shop the build timeout, not the visitor one', async () => {
    deployed(null, backend({ list: listOf(1) }));
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await pageListForBuild(shopEnv());

    expect(timeout).toHaveBeenCalledWith(BUILD_CATALOGUE_TIMEOUT_MS);
    expect(timeout).not.toHaveBeenCalledWith(CATALOGUE_TIMEOUT_MS);
    timeout.mockRestore();
  });

  it('reads the light page list and the Categories once, never the snapshot', async () => {
    const shop = backend({ list: listOf(2), categories: [] });
    deployed(2, shop);
    const env = shopEnv({ CATALOGUE_SHRINK_GUARD: 'true' });

    await pageListForBuild(env);
    await pageListForBuild(env);
    await categoriesForBuild(env);
    await categoriesForBuild(env);

    const reads = (path: string) =>
      shop.mock.calls.filter(([url]) => url.endsWith(path)).length;
    expect(reads('/store/catalogue-pages')).toBe(1);
    expect(reads('/store/categories')).toBe(1);
    expect(reads('/store/catalogue-snapshot')).toBe(0);
  });

  it('reads the page list once for a burst of dev pages, and again once it went stale', async () => {
    vi.stubEnv('MODE', 'development');
    vi.useFakeTimers();
    try {
      const shop = backend({ list: listOf(2) });
      deployed(null, shop);
      const env = shopEnv();
      const reads = () =>
        shop.mock.calls.filter(([url]) =>
          url.endsWith('/store/catalogue-pages'),
        ).length;

      await Promise.all([pageListForBuild(env), pageListForBuild(env)]);
      await pageListForBuild(env);
      expect(reads()).toBe(1);

      vi.advanceTimersByTime(DEV_BUILD_FRESH_MS);
      await pageListForBuild(env);
      expect(reads()).toBe(2);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it('keeps a dev page list whose load outlasted the freshness window', async () => {
    vi.stubEnv('MODE', 'development');
    vi.useFakeTimers();
    try {
      let answer = () => {};
      const held = new Promise<void>((resolve) => {
        answer = resolve;
      });
      const shop = backend({ list: listOf(2) });
      deployed(
        null,
        vi.fn(async (url: string) => {
          await held;
          return shop(url);
        }),
      );
      const env = shopEnv();

      const loading = pageListForBuild(env);
      vi.advanceTimersByTime(DEV_BUILD_FRESH_MS);
      answer();
      await loading;
      await pageListForBuild(env);

      expect(
        shop.mock.calls.filter(([url]) =>
          url.endsWith('/store/catalogue-pages'),
        ),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it('fails without the backend URL once the live site has part pages', async () => {
    deployed(120);

    await expect(
      pageListForBuild({ CATALOGUE_SHRINK_GUARD: 'true' }),
    ).rejects.toThrow('MEDUSA_BACKEND_URL');
  });

  it('builds without a catalogue while the live site has none', async () => {
    deployed(null);

    expect(
      (await pageListForBuild({ CATALOGUE_SHRINK_GUARD: 'true' })).parts,
    ).toEqual([]);
  });

  it('fails on a shop with no part pages once the catalogue is live, even when shrinking is allowed', async () => {
    deployed(120, backend());

    await expect(
      pageListForBuild(
        shopEnv({
          CATALOGUE_SHRINK_GUARD: 'true',
          CATALOGUE_SHRINK_ALLOWED: 'true',
        }),
      ),
    ).rejects.toThrow('0 part pages');
  });

  it('fails on far fewer part pages than the live site has', async () => {
    deployed(10, backend({ list: listOf(4) }));

    await expect(
      pageListForBuild(shopEnv({ CATALOGUE_SHRINK_GUARD: 'true' })),
    ).rejects.toThrow('4 part pages');
  });

  it('builds a catalogue that shrank by less than half', async () => {
    deployed(10, backend({ list: listOf(6) }));

    expect(
      (await pageListForBuild(shopEnv({ CATALOGUE_SHRINK_GUARD: 'true' })))
        .parts,
    ).toHaveLength(6);
  });

  it('builds a shrunken catalogue the owner allowed', async () => {
    deployed(10, backend({ list: listOf(4) }));

    expect(
      (
        await pageListForBuild(
          shopEnv({
            CATALOGUE_SHRINK_GUARD: 'true',
            CATALOGUE_SHRINK_ALLOWED: 'true',
          }),
        )
      ).parts,
    ).toHaveLength(4);
  });

  it('never asks the live site outside a deploy build', async () => {
    const shop = backend();
    deployed(120, shop);

    expect((await pageListForBuild(shopEnv())).parts).toEqual([]);
    expect(shop).toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      PREVIOUS_BUILD_URL,
      expect.anything(),
    );
  });

  it('names MEDUSA_BACKEND_URL and the URL it tried when the shop is down', async () => {
    const down = new TypeError('fetch failed');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(down)),
    );
    const env = shopEnv();

    const failure = await pageListForBuild(env).catch((error) => error);

    expect(failure.message).toContain('MEDUSA_BACKEND_URL');
    expect(failure.message).toContain(env.MEDUSA_BACKEND_URL);
    expect(failure.message).toContain('fetch failed');
    expect(failure.cause).toBe(down);
  });

  it('fails when the live site cannot say what it serves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => respond({}, false)),
    );

    await expect(
      pageListForBuild(shopEnv({ CATALOGUE_SHRINK_GUARD: 'true' })),
    ).rejects.toThrow('503');
  });

  describe('the Make list Keystatic and the content schemas read', () => {
    const listFile = async () =>
      pathToFileURL(
        join(await mkdtemp(join(tmpdir(), 'makes-')), 'makes.json'),
      );
    const kept = '[{"slug":"bmw","name":"BMW"}]';

    it('writes every catalogue Make the shop sends, by name, with its site flag', async () => {
      deployed(
        null,
        backend({
          makes: [
            { slug: 'mini', name: 'MINI', show_on_site: true },
            { slug: 'alfa-romeo', name: 'Alfa Romeo', show_on_site: false },
          ],
        }),
      );
      const file = await listFile();

      await writeCatalogueMakes(file, shopEnv());

      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([
        { slug: 'alfa-romeo', name: 'Alfa Romeo', show_on_site: false },
        { slug: 'mini', name: 'MINI', show_on_site: true },
      ]);
    });

    it('keeps the committed list for a shop that sends no Make list yet, or without a shop', async () => {
      deployed(null, backend());
      const file = await listFile();
      await writeFile(file, kept);

      await writeCatalogueMakes(file, shopEnv());
      await writeCatalogueMakes(file, {});

      expect(await readFile(file, 'utf8')).toBe(kept);
    });
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

describe('catalogueFromEnv', () => {
  it('builds a catalogue for a configured backend', () => {
    expect(
      catalogueFromEnv({
        MEDUSA_BACKEND_URL: 'http://shop.test',
        MEDUSA_PUBLISHABLE_KEY: 'pk_test',
      }),
    ).not.toBeNull();
  });

  it.each([
    ['without a backend', {}],
    [
      'with a backend',
      {
        MEDUSA_BACKEND_URL: 'http://shop.test',
        MEDUSA_PUBLISHABLE_KEY: 'pk_test',
      },
    ],
  ])(
    'leaves out a preview token it cannot read %s instead of failing the build',
    (_, shop) => {
      expect(() =>
        catalogueFromEnv({ ...shop, SHOP_PREVIEW_TOKEN: 'not a token' }),
      ).not.toThrow();
    },
  );

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

  describe('the visitor behind a call', () => {
    const SHOP = {
      MEDUSA_BACKEND_URL: 'http://shop.test',
      MEDUSA_PUBLISHABLE_KEY: 'pk_test',
    };
    const visitor = new Request('https://carlab.rs/api/cart', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const headersSent = async (env: CatalogueEnv, request?: Request) => {
      const fetch = vi.fn((_url: string, _init?: RequestInit) =>
        respond({ vehicles: [], next: null }),
      );
      vi.stubGlobal('fetch', fetch);
      await catalogueFromEnv(env, { visitor: request })
        ?.resolveVin(VIN)
        .catch(() => undefined);
      return new Headers(fetch.mock.calls[0]?.[1]?.headers);
    };

    let vinUrlSent = () => '';
    const vinBodySent = async (request?: Request) => {
      const fetch = vi.fn((_url: string, _init?: RequestInit) =>
        respond({ resolved: false, make: null, code: null }),
      );
      vi.stubGlobal('fetch', fetch);
      await catalogueFromEnv(SHOP, { visitor: request })?.resolveVin(VIN);
      vinUrlSent = () => String(fetch.mock.calls[0]?.[0]);
      return JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    };

    it('names the visitor to the shop, vouched for with the shop secret', async () => {
      const headers = await headersSent(
        { ...SHOP, SHOP_CLIENT_SECRET: 'secret' },
        visitor,
      );

      expect(headers.get('x-shop-client')).toBe('203.0.113.5');
      expect(headers.get('x-shop-client-secret')).toBe('secret');
    });

    it('takes the address the proxy forwarded over one the visitor claims', async () => {
      const headers = await headersSent(
        { ...SHOP, SHOP_CLIENT_SECRET: 'secret' },
        new Request('https://carlab.rs/api/cart', {
          headers: {
            'x-real-ip': '198.51.100.7',
            'x-forwarded-for': '203.0.113.5',
          },
        }),
      );

      expect(headers.get('x-shop-client')).toBe('203.0.113.5');
    });

    it("passes the proxy's request id on as the shop's, and only a well-formed one", async () => {
      const traced = await headersSent(
        SHOP,
        new Request('https://carlab.rs/api/cart', {
          headers: { 'x-request-id': 'fra1::iad1::abc-1700000000000' },
        }),
      );
      const malformed = await headersSent(
        SHOP,
        new Request('https://carlab.rs/api/cart', {
          headers: { 'x-request-id': 'not a request id' },
        }),
      );

      expect(traced.get('x-request-id')).toBe('fra1::iad1::abc-1700000000000');
      expect(malformed.has('x-request-id')).toBe(false);
      expect((await headersSent(SHOP)).has('x-request-id')).toBe(false);
    });

    it('tells the shop whether a VIN lookup came from a bot', async () => {
      const browsing = (agent: string) =>
        new Request('https://carlab.rs/sr/parts/search/', {
          headers: { 'user-agent': agent },
        });

      expect(
        await vinBodySent(
          browsing(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
          ),
        ),
      ).toEqual({ vin: VIN, bot: false, visitor_id: null });
      expect(
        await vinBodySent(browsing('Mozilla/5.0 (compatible; Googlebot/2.1)')),
      ).toEqual({ vin: VIN, bot: true, visitor_id: null });
      expect(await vinBodySent()).toEqual({
        vin: VIN,
        bot: null,
        visitor_id: null,
      });
    });

    it('hands the shop the visitor id cookie with a VIN lookup, in the body only', async () => {
      const visitorId = '0f8fad5b-d9cb-469f-a165-70867728950e';
      const withCookie = (cookie: string) =>
        new Request('https://carlab.rs/sr/parts/search/', {
          headers: { cookie },
        });

      expect(
        (await vinBodySent(withCookie(`lang=sr; visitor_id=${visitorId}`)))
          .visitor_id,
      ).toBe(visitorId);
      expect(
        (await vinBodySent(withCookie('visitor_id=not-a-uuid'))).visitor_id,
      ).toBeNull();
      expect((await vinBodySent(withCookie('lang=sr'))).visitor_id).toBeNull();
      expect(vinUrlSent()).not.toContain(visitorId);
    });

    it('hands the shop the visitor id cookie in a header, never in the URL', async () => {
      const visitorId = '0f8fad5b-d9cb-469f-a165-70867728950e';
      const searchSent = async (cookie: string) => {
        const fetch = vi.fn((_url: string, _init?: RequestInit) => respond({}));
        vi.stubGlobal('fetch', fetch);
        await catalogueFromEnv(SHOP, {
          visitor: new Request('https://carlab.rs/sr/parts/search/', {
            headers: { cookie },
          }),
        })?.search({ q: 'hu 816', locale: 'sr', facets: [] });
        const [url, init] = fetch.mock.calls[0] ?? [];
        return { url: String(url), headers: new Headers(init?.headers) };
      };

      const sent = await searchSent(`lang=sr; visitor_id=${visitorId}`);
      expect(sent.headers.get('x-visitor-id')).toBe(visitorId);
      expect(sent.url).not.toContain(visitorId);
      expect(
        (await searchSent('visitor_id=not-a-uuid')).headers.has('x-visitor-id'),
      ).toBe(false);
    });

    it('names nobody without the secret, without a visitor, or for an address that is none', async () => {
      for (const sent of [
        await headersSent(SHOP, visitor),
        await headersSent({ ...SHOP, SHOP_CLIENT_SECRET: 'secret' }),
        await headersSent(
          { ...SHOP, SHOP_CLIENT_SECRET: 'secret' },
          new Request('https://carlab.rs/', {
            headers: { 'x-real-ip': 'everyone' },
          }),
        ),
      ]) {
        expect(sent.has('x-shop-client')).toBe(false);
        expect(sent.has('x-shop-client-secret')).toBe(false);
      }
    });
  });
});

describe('catalogue.resolveVin', () => {
  it('names the car a VIN resolved to and its nearest place with a page', async () => {
    const place = {
      kind: 'series',
      make: { slug: 'bmw', name: 'BMW' },
      series: { name: '3 серия', translations: null },
      model: null,
      vehicle: null,
    };
    const fetch = answer({
      resolved: true,
      vehicle: VEHICLE,
      facts: {},
      place,
    });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'vehicle',
      vehicle: VEHICLE,
      facts: {},
      place,
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/vin-lookups',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ vin: VIN, bot: null, visitor_id: null }),
      }),
    );
  });

  it('falls back to the inquiry for an unresolved VIN', async () => {
    const fetch = answer({ resolved: false, make: 'bmw', code: '99ZZ' });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
      place: null,
    });
  });

  it('falls back to the inquiry when the backend answers with an error', async () => {
    expect(await catalog(answer({}, false)).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
      place: null,
    });
  });

  it('falls back to the inquiry when the body breaks the contract', async () => {
    const fetch = answer({ resolved: true, vehicle: { id: 'veh_1' } });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
      place: null,
    });
  });

  it('falls back to the inquiry when the backend is unreachable', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
      place: null,
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
      place: null,
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

  it('scopes a Category listing to one Model of its Make', async () => {
    const fetch = answer(found);

    await catalog(fetch).search({
      category: 'oil-filters',
      make: 'bmw',
      model: 'f30-320d',
      locale: 'ru',
      facets: [],
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/search?locale=ru&category=oil-filters&make=bmw&model=f30-320d',
      expect.anything(),
    );
  });

  it('asks the shop for the popular order of a listing', async () => {
    const fetch = answer(found);

    await catalog(fetch).search({
      category: 'oil-filters',
      locale: 'ru',
      facets: [],
      sort: 'popular',
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/search?locale=ru&category=oil-filters&sort=popular',
      expect.anything(),
    );
  });

  it('lists in the default order from a shop that does not know the popular one yet', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetch = vi.fn((url: string) =>
      respond(url.includes('sort=') ? {} : found, !url.includes('sort=')),
    );

    const listed = await catalog(fetch).search({
      category: 'oil-filters',
      locale: 'ru',
      facets: [],
      sort: 'popular',
    });

    expect(listed?.count).toBe(found.count);
    expect(fetch).toHaveBeenLastCalledWith(
      'http://shop.test/store/search?locale=ru&category=oil-filters',
      expect.anything(),
    );
    error.mockRestore();
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

  const stockAndPrice = {
    q: 'x',
    locale: 'ru' as const,
    facets: ['in-stock:true', 'brand:bosch'],
    ranges: [
      { key: 'price', min: 100, max: 9999 },
      { key: 'capacity', min: 70, max: null },
    ],
  };

  it('never asks the shop to filter by stock or price while prices are hidden', async () => {
    const fetch = answer(found);

    await createCatalogue({
      backendUrl: 'http://shop.test',
      publishableKey: 'pk_test',
      fetch: fetch as unknown as typeof globalThis.fetch,
      shopOpen: false,
    }).search(stockAndPrice);

    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/search?q=x&locale=ru&facets=brand%3Abosch&range=capacity%3A70%3A',
      expect.anything(),
    );
  });

  it('filters by stock and price once prices show', async () => {
    const fetch = answer(found);

    await catalog(fetch).search(stockAndPrice);

    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/search?q=x&locale=ru&facets=in-stock%3Atrue&facets=brand%3Abosch&range=price%3A100%3A9999&range=capacity%3A70%3A',
      expect.anything(),
    );
  });

  it('asks for a few matches and the cars when suggesting', async () => {
    const car = {
      kind: 'make',
      make: { slug: 'bmw', name: 'BMW' },
      series: null,
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

  it('spells a brand typed in Cyrillic the way the catalogue does', async () => {
    const fetch = answer(found);

    await catalog(fetch).search({
      q: 'Варта 74',
      locale: 'ru',
      facets: [],
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/search?q=varta+74&locale=ru',
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

  it('gives each result the key specs of its Category', async () => {
    const volume = {
      key: 'volume',
      type: 'number',
      unit: 'л',
      label: 'Объем',
      translations: null,
      required: false,
      facet: false,
      rank: 0,
      options: [],
    };
    const fetch = vi.fn((url: string) =>
      url.endsWith('/store/categories')
        ? respond({
            categories: [
              {
                ...category('oil-filters', 'Масляные фильтры'),
                fields: [volume],
              },
            ],
          })
        : respond({
            ...found,
            results: [
              ...found.results,
              {
                ...found.results[0],
                part: {
                  ...found.results[0].part,
                  attributes: { volume: 5 },
                },
              },
            ],
          }),
    );

    const result = await catalog(fetch).search({
      category: 'oil-filters',
      locale: 'ru',
      facets: [],
    });

    expect(result?.results.map(({ specs }) => specs)).toEqual(['', '5 л']);
  });

  it('drops a spec every part of the Category shares, even for a lone result', async () => {
    const field = (key: string, unit: string, rank: number) => ({
      key,
      type: 'number',
      unit,
      label: key,
      translations: null,
      required: false,
      facet: false,
      rank,
      options: [],
    });
    const withAttributes = (attributes: Record<string, number>) => ({
      ...found.results[0],
      part: { ...found.results[0].part, attributes },
    });
    const fetch = vi.fn((url: string) =>
      url.endsWith('/store/categories')
        ? respond({
            categories: [
              {
                ...category('oil-filters', 'Масляные фильтры'),
                fields: [field('voltage', 'В', 0), field('volume', 'л', 1)],
              },
            ],
          })
        : url.includes('q=')
          ? respond({
              ...found,
              results: [withAttributes({ voltage: 12, volume: 5 })],
            })
          : respond({
              ...found,
              results: [
                withAttributes({ voltage: 12, volume: 5 }),
                withAttributes({ voltage: 12, volume: 4 }),
              ],
            }),
    );

    const result = await catalog(fetch).search({
      q: 'HU816x',
      locale: 'ru',
      facets: [],
    });

    expect(result?.results[0].specs).toBe('5 л');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('category=oil-filters'),
      expect.anything(),
    );
  });

  it('asks for no Categories when no result carries attributes', async () => {
    const fetch = answer(found);

    const result = await catalog(fetch).search({
      q: 'x',
      locale: 'ru',
      facets: [],
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result?.results[0].specs).toBe('');
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

describe('catalogue.listingScope', () => {
  it('names the Category and Model a filtered listing belongs to', async () => {
    const scope = await catalogueWith(
      backend({
        categories: [
          { ...oilFilters, translations: { sr: { name: 'Filteri ulja' } } },
        ],
        vehicles: [VEHICLE],
      }),
    ).listingScope(
      { category: 'oil-filters', make: 'bmw', model: 'f30-320d' },
      'sr',
    );

    expect(scope).toEqual({
      category: { slug: 'oil-filters', name: 'Filteri ulja' },
      model: VEHICLE.model,
      scope_pages: null,
    });
  });

  it('asks the shop for the one Model, not every Vehicle', async () => {
    const fetch = backend({ vehicles: [VEHICLE] });

    await catalogueWith(fetch).listingScope(
      { make: 'bmw', model: 'f30-320d' },
      'ru',
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `${BACKEND_URL}/store/vehicles?make=bmw&model=f30-320d&limit=1`,
      expect.anything(),
    );
  });

  it('finds the Model in the whole list of a shop that cannot filter', async () => {
    const other = {
      ...VEHICLE,
      id: 'veh_g20',
      model: { ...VEHICLE.model, slug: 'g20-320d' },
    };

    const scope = await catalogueWith(
      backend({ vehicles: [other, VEHICLE] }),
    ).listingScope({ make: 'bmw', model: 'f30-320d' }, 'ru');

    expect(scope?.model).toEqual(VEHICLE.model);
  });

  it('names no Model without its Make', async () => {
    const fetch = backend({ vehicles: [VEHICLE] });

    const scope = await catalogueWith(fetch).listingScope(
      { model: 'f30-320d' },
      'ru',
    );

    expect(scope?.model).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('names nothing when the backend cannot answer', async () => {
    const scope = await catalogueWith(
      vi.fn(() => respond({}, false)),
    ).listingScope({ category: 'oil-filters' }, 'ru');

    expect(scope).toBeNull();
  });
});

describe('the build record', () => {
  it('tells the next build how many part pages this one serves', async () => {
    const response = await recordBuild({} as Parameters<typeof recordBuild>[0]);

    expect(await response.json()).toEqual({ partPages: 0 });
  });
});

describe('shopBackendUrl', () => {
  it.each([
    [
      'the internal address when set',
      'http://medusa:9000',
      'http://medusa:9000',
    ],
    ['the build address when unset', undefined, 'https://api.carlab.test'],
    ['the build address when empty', '', 'https://api.carlab.test'],
    ['the build address when not a URL', 'medusa', 'https://api.carlab.test'],
  ])('is %s', (_, internal, expected) => {
    expect(shopBackendUrl('https://api.carlab.test', internal)).toBe(expected);
  });

  it('reads SHOP_INTERNAL_URL from the process environment by default', () => {
    vi.stubEnv('SHOP_INTERNAL_URL', 'http://medusa:9000');
    expect(shopBackendUrl('https://api.carlab.test')).toBe(
      'http://medusa:9000',
    );
    vi.unstubAllEnvs();
  });
});
