import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { content } from '@/i18n/content';
import {
  parseHtml,
  wirePage,
  respond,
  setShop,
  SHOP_PREVIEW_TOKEN,
  stubShop,
} from '@/components/renderAstro';
import type { RelatedPartPage } from '@podbor/catalog-contract';
import SeriesPage from './index.astro';

const copy = content('ru').partsSearch;
const hubCopy = content('ru').partsCar.hubs.model;

const PUBLIC_PAGE = 'public, s-maxage=86400';
const NOT_FOUND_PAGE = 'public, s-maxage=600';

const oilFilters = {
  id: 'category_oil',
  slug: 'oil-filters',
  name: 'Масляные фильтры',
  text: '',
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: null,
  service_price: null,
  service_note: null,
  installation_price: null,
  image: null,
  fields: [],
} as unknown as Category;

const make = { slug: 'bmw', name: 'BMW' };
const series = {
  name: '3 Series',
  slug: '3-series',
  translations: null,
  make,
};

const f30 = {
  id: 'veh_1',
  slug: null,
  power_kw: 140,
  drive: null,
  market: null,
  steering: null,
  engine: {
    code: 'B47D20',
    family: 'B47',
    fuel: 'diesel',
    displacement_cc: 1995,
  },
  year_from: 2015,
  year_to: 2019,
  identifiers: [],
  requirements: [],
  model: {
    slug: 'f30-320d',
    name: '320d',
    chassis: { code: 'F30', body_style: 'sedan', series },
  },
};

const demanded = (id: string) =>
  wirePage({
    id,
    slug: `mann-${id}`,
    value: id,
    demand: { score: 6, popular: true, top: false },
    part: { ...wirePage().part, id: `part_${id}`, category_id: 'category_oil' },
  });

const hubAnswer = (pages: RelatedPartPage[], models: unknown[] = []) => ({
  series,
  models: models.map((vehicle) => ({ vehicles: [vehicle] })),
  categories: [oilFilters],
  popular: pages.map(({ category: _category, ...page }) => page),
});

const seriesResponse = (
  pages: RelatedPartPage[],
  {
    models,
    path = '/ru/parts/bmw/3-series/',
    headers = {},
  }: {
    models?: unknown[];
    path?: string;
    headers?: Record<string, string>;
  } = {},
) => {
  const shop = stubShop(() => Response.json(hubAnswer(pages, models)));
  const [, locale, , make, series] = new URL(
    path,
    'https://carlab.rs',
  ).pathname.split('/');
  return {
    shop,
    response: respond(
      SeriesPage,
      new Request(new URL(path, 'https://carlab.rs'), { headers }),
      { params: { locale, make, series } },
    ),
  };
};

const seriesPage = async (pages: RelatedPartPage[], models?: unknown[]) => {
  setShop(false);
  return parseHtml(
    await (await seriesResponse(pages, { models }).response).text(),
  );
};

const headings = (root: Element) =>
  [...root.querySelectorAll('h2')].map((heading) =>
    heading.textContent?.trim(),
  );

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('the Series page', () => {
  it('links each category of the Series to its page', async () => {
    const root = await seriesPage([wirePage()]);

    expect(
      root.querySelector('a[href="/ru/parts/bmw/3-series/oil-filters/"]'),
    ).not.toBeNull();
  });

  it('lists each modification as a link into the parts search scoped to it', async () => {
    const root = await seriesPage([wirePage()], [f30]);
    const link = root.querySelector<HTMLAnchorElement>(
      'a[href="/ru/parts/search/?make=bmw&model=f30-320d"]',
    );

    expect(headings(root)).toContain(hubCopy.carsHeading);
    expect(link?.textContent).toContain('BMW 3 Series F30 320d');
    expect(link?.textContent).toContain('B47D20');
  });

  it('shows no modifications block while the Series lists none', async () => {
    const root = await seriesPage([wirePage()]);

    expect(headings(root)).not.toContain(hubCopy.carsHeading);
  });
});

describe('demand on the Series page', () => {
  it('names the Series over what is often ordered for it', async () => {
    const root = await seriesPage([demanded('a'), demanded('b')]);

    expect(headings(root)).toContain(
      copy.popularForCar.replace('{car}', 'BMW 3 Series'),
    );
  });

  it('shows no block while only one part fitting the Series is popular', async () => {
    const root = await seriesPage([demanded('a'), wirePage()]);

    expect(
      headings(root).some((heading) =>
        heading?.startsWith(copy.popularHeading),
      ),
    ).toBe(false);
  });
});

describe('the Series page rendered on demand', () => {
  it('answers an anonymous visitor with a page the shared cache may keep', async () => {
    setShop(false);
    const response = await seriesResponse([wirePage()]).response;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(PUBLIC_PAGE);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('asks the shop for the page in the locale of the path', async () => {
    setShop(false);
    const { shop, response } = seriesResponse([wirePage()], {
      path: '/sr/parts/bmw/3-series/',
    });
    await response;
    const [url, init] = shop.mock.calls[0];

    expect(String(url)).toBe(
      'http://shop.test/store/catalogue-pages/series/bmw/3-series',
    );
    expect(new Headers(init?.headers).get('x-catalogue-locale')).toBe('sr');
  });

  it('answers a Series below the page rules with a 404 the cache keeps like a page', async () => {
    setShop(false);
    stubShop(() => new Response(null, { status: 404 }));
    const response = await respond(
      SeriesPage,
      new Request('https://carlab.rs/ru/parts/bmw/tiny/'),
      { params: { locale: 'ru', make: 'bmw', series: 'tiny' } },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(NOT_FOUND_PAGE);
  });

  it('asks the visitor to retry, uncached, when the shop fails', async () => {
    setShop(false);
    stubShop(() => new Response(null, { status: 500 }));
    const response = await respond(
      SeriesPage,
      new Request('https://carlab.rs/ru/parts/bmw/3-series/'),
      { params: { locale: 'ru', make: 'bmw', series: '3-series' } },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps a preview visitor out of the cache and asks the shop for prices', async () => {
    setShop(false);
    const { shop, response } = seriesResponse([wirePage()], {
      headers: { cookie: `auto_service_shop_preview=${SHOP_PREVIEW_TOKEN}` },
    });
    const answered = await response;

    expect(answered.headers.get('cache-control')).toBe('private, no-store');
    expect(
      new Headers(shop.mock.calls[0][1]?.headers).get('x-shop-preview'),
    ).toBe(SHOP_PREVIEW_TOKEN);
  });

  it('keeps the canonical and hreflang of the static page', async () => {
    setShop(false);
    const root = parseHtml(
      await (await seriesResponse([wirePage()]).response).text(),
    );
    const alternates = [
      ...root.querySelectorAll('link[rel="alternate"][hreflang]'),
    ].map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]);

    expect(
      root.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://carlab.rs/ru/parts/bmw/3-series/');
    expect(alternates).toContainEqual([
      'sr',
      'https://carlab.rs/sr/parts/bmw/3-series/',
    ]);
    expect(root.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('prints no query string, so the cached copy fits every visit', async () => {
    setShop(false);
    const html = await (
      await seriesResponse([wirePage()], {
        path: '/ru/parts/bmw/3-series/?utm_source=visit493',
      }).response
    ).text();

    expect(html).not.toContain('visit493');
  });
});
