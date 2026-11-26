import type { CataloguePageList } from '@podbor/catalog-contract';

import {
  carsLinks,
  cataloguePaths,
  sitemapChunkPaths,
  warmCataloguePages,
} from '../prewarm';

const ORIGIN = 'https://carlab.rs';

const list = (): CataloguePageList => ({
  parts: [{ slug: 'bosch-0986', indexable: true }],
  makes: [
    { slug: 'bmw', name: 'BMW', hub: true, parts: 5 },
    { slug: 'kia', name: 'Kia', hub: false, parts: 1 },
  ],
  series: [
    {
      slug: 'x3',
      name: 'X3',
      make: 'bmw',
      categories: ['brakes'],
      listed: null,
    },
  ],
  categories: [
    { slug: 'brakes', name: 'Brakes', listed: 40, demand: 0 },
    { slug: 'oil', name: 'Oil', listed: 2, demand: 0 },
  ],
  catalogue_makes: null,
});

const carsHtml = (locale: string, makes: string[], pages: number[] = []) =>
  [...makes, ...pages.map(String)]
    .map((segment) => `<a href="/${locale}/cars/${segment}/">x</a>`)
    .join('');

const SITEMAP_INDEX = `<sitemapindex><sitemap><loc>${ORIGIN}/sitemap-catalogue-0.xml</loc></sitemap><sitemap><loc>${ORIGIN}/sitemap-catalogue-1.xml</loc></sitemap></sitemapindex>`;

describe('cataloguePaths', () => {
  it('lists hubs, makes with a hub, categories and llms in every locale, plus the root files', () => {
    const paths = cataloguePaths(list());
    for (const locale of ['ru', 'sr', 'en']) {
      expect(paths).toEqual(
        expect.arrayContaining([
          `/${locale}/parts/`,
          `/${locale}/parts/makes/`,
          `/${locale}/parts/bmw/`,
          `/${locale}/parts/c/brakes/`,
          `/${locale}/parts/c/oil/`,
          `/${locale}/llms.txt`,
        ]),
      );
    }
    expect(paths).toEqual(
      expect.arrayContaining(['/llms.txt', '/catalogue-build.json']),
    );
    expect(paths).not.toContain('/sr/parts/kia/');
  });

  it('leaves series and Part pages alone', () => {
    expect(
      cataloguePaths(list()).filter(
        (path) => path.includes('/x3/') || path.includes('/p/'),
      ),
    ).toEqual([]);
  });
});

describe('carsLinks', () => {
  it('splits make links from pager links of its own locale', () => {
    expect(
      carsLinks(
        'sr',
        carsHtml('sr', ['bmw', 'audi'], [2, 3]) + carsHtml('en', ['kia']),
      ),
    ).toEqual({ makes: ['bmw', 'audi'], pages: ['2', '3'] });
  });
});

describe('sitemapChunkPaths', () => {
  it('reads the chunk paths and skips a malformed loc', () => {
    expect(sitemapChunkPaths(`${SITEMAP_INDEX}<loc>nope</loc>`)).toEqual([
      '/sitemap-catalogue-0.xml',
      '/sitemap-catalogue-1.xml',
    ]);
  });
});

describe('warmCataloguePages', () => {
  const respond = (url: string) => {
    const { pathname } = new URL(url);
    if (pathname === '/sitemap-catalogue.xml') return SITEMAP_INDEX;
    const cars = /^\/(\w+)\/cars\/$/.exec(pathname);
    if (cars) return carsHtml(cars[1] ?? '', ['bmw', 'audi'], [2]);
    const page2 = /^\/(\w+)\/cars\/2\/$/.exec(pathname);
    if (page2) return carsHtml(page2[1] ?? '', ['vw']);
    return '';
  };

  const fake = (failing: (url: string) => boolean = () => false) => {
    const seen: string[] = [];
    let inFlight = 0;
    let peak = 0;
    const fetchPage = (async (input: string) => {
      seen.push(input);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      if (failing(input)) throw new Error('down');
      return new Response(respond(input), { status: 200 });
    }) as unknown as typeof fetch;
    return { fetchPage, seen, peak: () => peak };
  };

  it('requests the whole hub set once each, discovering cars makes and sitemap chunks', async () => {
    const { fetchPage, seen, peak } = fake();
    const result = await warmCataloguePages(ORIGIN, list(), { fetchPage });
    const paths = seen.map((url) => url.slice(ORIGIN.length));
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/sr/parts/',
        '/ru/parts/bmw/',
        '/en/parts/c/oil/',
        '/sr/cars/bmw/',
        '/sr/cars/vw/',
        '/en/cars/audi/',
        '/sr/cars/2/',
        '/sitemap-catalogue.xml',
        '/sitemap-catalogue-0.xml',
        '/sitemap-catalogue-1.xml',
        '/llms.txt',
        '/ru/llms.txt',
        '/catalogue-build.json',
      ]),
    );
    expect(result).toEqual({ warmed: paths.length, failed: 0 });
    expect(peak()).toBe(2);
  });

  it('swallows errors and counts them', async () => {
    const { fetchPage, seen } = fake((url) => url.includes('/parts/bmw/'));
    const result = await warmCataloguePages(ORIGIN, list(), { fetchPage });
    expect(result.failed).toBe(3);
    expect(result.warmed).toBe(seen.length - 3);
  });

  it('counts a non-2xx answer as failed', async () => {
    const fetchPage = (async () =>
      new Response('', { status: 503 })) as unknown as typeof fetch;
    const result = await warmCataloguePages(ORIGIN, list(), { fetchPage });
    expect(result.warmed).toBe(0);
    expect(result.failed).toBeGreaterThan(0);
  });

  it('aborts a request after the timeout', async () => {
    const fetchPage = ((_: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('t')));
      })) as unknown as typeof fetch;
    const result = await warmCataloguePages(ORIGIN, list(), {
      fetchPage,
      timeoutMs: 5,
    });
    expect(result.warmed).toBe(0);
    expect(result.failed).toBeGreaterThan(0);
  });
});
