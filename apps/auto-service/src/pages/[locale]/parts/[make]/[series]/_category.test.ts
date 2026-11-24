import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { content } from '@/i18n/content';
import {
  isOrange,
  parseHtml,
  partPage,
  respond,
  setShop,
  SHOP_PREVIEW_TOKEN,
  stubShop,
  wirePart,
} from '@/components/renderAstro';
import SeriesCategoryPage from './[category].astro';

const copy = content('ru').partsSearch;

const PUBLIC_PAGE =
  'public, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=86400';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const oilFilters = {
  id: 'category_oil',
  slug: 'oil-filters',
  name: 'Масляные фильтры',
  text: 'Фильтр.',
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

const bmw = { name: 'BMW', slug: 'bmw' };
const series = {
  name: '3 Series',
  slug: '3-series',
  translations: null,
  make: bmw,
};

const numbers = [
  partPage({ id: 'pi_bmw', slug: 'bmw-11428507683', brand: bmw }),
  partPage({
    id: 'pi_bmw_old',
    slug: 'bmw-11427953125',
    superseded: true,
    brand: bmw,
  }),
  partPage({
    id: 'pi_mann',
    slug: 'mann-hu816x',
    brand: { name: 'MANN', slug: 'mann' },
    demand: { score: 3, popular: false, top: false },
  }),
];

const seriesCategoryResponse = (
  { path = '/ru/parts/bmw/3-series/oil-filters/', headers = {} } = {} as {
    path?: string;
    headers?: Record<string, string>;
  },
) => {
  const shop = stubShop(() =>
    Response.json({
      series,
      category: oilFilters,
      parts: [
        {
          pages: numbers.map(({ category: _category, ...page }) =>
            wirePart({ ...page, category: null }),
          ),
          fits: [],
        },
      ],
    }),
  );
  const [, locale, , make, seriesSlug, category] = new URL(
    path,
    'https://carlab.rs',
  ).pathname.split('/');
  return {
    shop,
    response: respond(
      SeriesCategoryPage,
      new Request(new URL(path, 'https://carlab.rs'), { headers }),
      { params: { locale, make, series: seriesSlug, category } },
    ),
  };
};

const seriesCategory = async () => {
  setShop(true);
  return parseHtml(await (await seriesCategoryResponse().response).text());
};

describe('the Series category page', () => {
  it('links the whole category in ink, not orange', async () => {
    const page = await seriesCategory();
    const link = [...page.querySelectorAll('a')].find(
      (anchor) =>
        anchor.textContent?.trim() === content('ru').shopPart.categoryLink,
    )!;

    expect(link.getAttribute('href')).toBe('/ru/parts/c/oil-filters/');
    expect(isOrange(link)).toBe(false);
  });

  it('walks back up through the Series page', async () => {
    const page = await seriesCategory();

    expect(
      page.querySelector('a[href="/ru/parts/bmw/3-series/"]'),
    ).not.toBeNull();
  });

  it('counts the current numbers and says so', async () => {
    const page = await seriesCategory();

    expect(page.textContent).toContain(
      copy.foundNumbers.replace('{count}', '2'),
    );
  });

  it('offers no filters that would leave the Series for the whole category', async () => {
    const page = await seriesCategory();

    expect(page.querySelector('filter-sheet')).toBeNull();
    expect(page.querySelector('nav[aria-label="Порядок"]')).toBeNull();
  });
});

describe('the Series category page rendered on demand', () => {
  it('answers an anonymous visitor with a page the shared cache may keep', async () => {
    setShop(false);
    const response = await seriesCategoryResponse().response;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(PUBLIC_PAGE);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('asks the shop for the page in the locale of the path', async () => {
    setShop(false);
    const { shop, response } = seriesCategoryResponse({
      path: '/sr/parts/bmw/3-series/oil-filters/',
    });
    await response;
    const [url, init] = shop.mock.calls[0];

    expect(String(url)).toBe(
      'http://shop.test/store/catalogue-pages/series/bmw/3-series/oil-filters',
    );
    expect(new Headers(init?.headers).get('x-catalogue-locale')).toBe('sr');
  });

  it('answers a place below the page rules with a 404 the cache keeps like a page', async () => {
    setShop(false);
    stubShop(() => new Response(null, { status: 404 }));
    const response = await respond(
      SeriesCategoryPage,
      new Request('https://carlab.rs/ru/parts/bmw/3-series/brakes/'),
      {
        params: {
          locale: 'ru',
          make: 'bmw',
          series: '3-series',
          category: 'brakes',
        },
      },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(PUBLIC_PAGE);
  });

  it('asks the visitor to retry, uncached, when the shop fails', async () => {
    setShop(false);
    stubShop(() => new Response(null, { status: 503 }));
    const response = await respond(
      SeriesCategoryPage,
      new Request('https://carlab.rs/ru/parts/bmw/3-series/oil-filters/'),
      {
        params: {
          locale: 'ru',
          make: 'bmw',
          series: '3-series',
          category: 'oil-filters',
        },
      },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps a preview visitor out of the cache and asks the shop for prices', async () => {
    setShop(false);
    const { shop, response } = seriesCategoryResponse({
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
      await (await seriesCategoryResponse().response).text(),
    );
    const alternates = [
      ...root.querySelectorAll('link[rel="alternate"][hreflang]'),
    ].map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]);

    expect(
      root.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://carlab.rs/ru/parts/bmw/3-series/oil-filters/');
    expect(alternates).toContainEqual([
      'sr',
      'https://carlab.rs/sr/parts/bmw/3-series/oil-filters/',
    ]);
  });

  it('prints no query string, so the cached copy fits every visit', async () => {
    setShop(false);
    const html = await (
      await seriesCategoryResponse({
        path: '/ru/parts/bmw/3-series/oil-filters/?gclid=click493',
      }).response
    ).text();

    expect(html).not.toContain('click493');
  });
});
