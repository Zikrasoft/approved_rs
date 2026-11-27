import { afterEach, describe, expect, it, vi } from 'vitest';
import { withPlaceholder } from '@podbor/i18n';
import { content } from '@/i18n/content';
import {
  parseHtml,
  respond,
  setShop,
  SHOP_PREVIEW_TOKEN,
  stubShop,
} from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import { getCollection } from 'astro:content';
import MakePage from './index.astro';
import SeriesRoute from './[series]/index.astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn(async () => []) }));

const PUBLIC_PAGE = 'public, s-maxage=86400';
const copy = content('ru').partsCar.hubs.make;
const NOT_FOUND_PAGE = 'public, s-maxage=600';

const series = (name: string, slug: string, categories: string[] = []) => ({
  slug,
  name,
  category_names: categories,
});

type Answer = ReturnType<typeof series>[];

const hubResponse = (
  make = { slug: 'bmw', name: 'BMW' },
  entries: Answer = [series('1', '1')],
  { path = `/ru/parts/${make.slug}/`, headers = {} } = {},
) => {
  const shop = stubShop((url) =>
    url.pathname.includes('/makes/')
      ? Response.json({ make, series: entries })
      : new Response(null, { status: 404 }),
  );
  const [, locale, , slug, segment] = path.split('/');
  return {
    shop,
    response: respond(
      segment ? SeriesRoute : MakePage,
      new Request(new URL(path, 'https://carlab.rs'), { headers }),
      { params: { locale, make: slug, ...(segment && { series: segment }) } },
    ),
  };
};

const many = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    series(`Golf ${String(index + 1).padStart(3, '0')}`, `golf-${index + 1}`),
  );

const VW = { slug: 'volkswagen', name: 'Volkswagen' };
const tiles = (page: ParentNode) =>
  [...page.querySelectorAll('[data-search-idle] a[data-search-href]')].map(
    (link) => link.getAttribute('href'),
  );

const hubHtml = async (...args: Parameters<typeof hubResponse>) =>
  parseHtml(await (await hubResponse(...args).response).text());

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.mocked(getCollection).mockResolvedValue([] as never);
});

describe('the make hub', () => {
  it('names each series with its make, in name order', async () => {
    setShop(false);
    const page = await hubHtml({ slug: 'bmw', name: 'BMW' }, [
      series('3 GT', '3-gt', ['Фильтры', 'Тормоза']),
      series('1', '1'),
    ]);
    const rows = [
      ...page.querySelectorAll(`main ul a[href^="/ru/parts/bmw/"]`),
    ];

    expect(rows.map((link) => link.textContent?.trim())).toEqual([
      'BMW 1',
      'BMW 3 GT',
    ]);
    expect(rows[1].getAttribute('href')).toBe('/ru/parts/bmw/3-gt/');
  });

  it('offers no search and no pages for a short list', async () => {
    setShop(false);
    const page = await hubHtml(VW, many(40));

    expect(tiles(page)).toHaveLength(40);
    expect(page.querySelector('[data-search-input]')).toBeNull();
    expect(page.querySelector('nav a[href*="/page-"]')).toBeNull();
  });

  it('searches every series of a long list, not only the page shown', async () => {
    setShop(false);
    const page = await hubHtml(VW, many(100));
    const index = JSON.parse(
      page.querySelector('script[data-search-index]')?.textContent ?? '[]',
    );

    expect(
      page.querySelector('list-search [data-search-input]'),
    ).not.toBeNull();
    expect(
      page.querySelector('[data-search-input]')?.getAttribute('placeholder'),
    ).toBe(copy.searchPlaceholder);
    expect(page.querySelector('[data-search-empty]')?.textContent?.trim()).toBe(
      copy.noMatch,
    );
    expect(
      page
        .querySelector<HTMLTemplateElement>('template[data-search-template]')
        ?.content.querySelector('[data-search-href] [data-search-name]'),
    ).not.toBeNull();
    expect(index).toHaveLength(100);
    expect(index[99]).toEqual({
      name: 'Volkswagen Golf 100',
      href: '/ru/parts/volkswagen/golf-100/',
    });
  });

  it('shows the first page of a long list and links the next ones', async () => {
    setShop(false);
    const page = await hubHtml(VW, many(100));
    const pages = [...page.querySelectorAll('nav a')]
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.includes('/page-'));

    expect(tiles(page)).toHaveLength(48);
    expect(tiles(page)[0]).toBe('/ru/parts/volkswagen/golf-1/');
    expect(pages).toEqual(
      expect.arrayContaining([
        '/ru/parts/volkswagen/page-2/',
        '/ru/parts/volkswagen/page-3/',
      ]),
    );
    expect(page.querySelector('link[rel="next"]')?.getAttribute('href')).toBe(
      '/ru/parts/volkswagen/page-2/',
    );
  });

  it('answers a later page under the series segment, canonical to itself', async () => {
    setShop(false);
    const { shop, response } = hubResponse(VW, many(100), {
      path: '/ru/parts/volkswagen/page-3/',
    });
    const answer = await response;
    const page = parseHtml(await answer.text());

    expect(answer.status).toBe(200);
    expect(answer.headers.get('cache-control')).toBe(PUBLIC_PAGE);
    expect(String(shop.mock.calls[0][0])).toBe(
      'http://shop.test/store/catalogue-pages/makes/volkswagen',
    );
    expect(tiles(page)).toEqual(
      many(100)
        .slice(96)
        .map(({ slug }) => `/ru/parts/volkswagen/${slug}/`),
    );
    expect(
      page.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://carlab.rs/ru/parts/volkswagen/page-3/');
    expect(page.querySelector('link[rel="prev"]')?.getAttribute('href')).toBe(
      '/ru/parts/volkswagen/page-2/',
    );
    expect(page.querySelector('h1')?.textContent?.trim()).toBe(
      withPlaceholder(
        withPlaceholder(copy.pageName, 'make', 'Volkswagen'),
        'page',
        '3',
      ),
    );
    expect(page.querySelector('title')?.textContent).toContain('3');
  });

  it.each(['page-4', 'page-1', 'page-02'])(
    'answers %s with a 404',
    async (segment) => {
      setShop(false);
      const { response } = hubResponse(VW, many(100), {
        path: `/ru/parts/volkswagen/${segment}/`,
      });

      expect((await response).status).toBe(404);
    },
  );

  it('asks the shop for the Make in the locale of the path', async () => {
    setShop(false);
    const { shop, response } = hubResponse(undefined, undefined, {
      path: '/sr/parts/bmw/',
    });
    await response;
    const [url, init] = shop.mock.calls[0];

    expect(String(url)).toBe(
      'http://shop.test/store/catalogue-pages/makes/bmw',
    );
    expect(new Headers(init?.headers).get('x-catalogue-locale')).toBe('sr');
  });

  it('answers with a page the shared cache may keep and no cookie', async () => {
    setShop(false);
    const response = await hubResponse().response;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(PUBLIC_PAGE);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('is indexable and canonical to its own path', async () => {
    setShop(false);
    const page = await hubHtml();

    expect(
      page.querySelector('meta[name="robots"][content*="noindex"]'),
    ).toBeNull();
    expect(
      page.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://carlab.rs/ru/parts/bmw/');
    expect(
      page
        .querySelector('link[rel="alternate"][hreflang="sr"]')
        ?.getAttribute('href'),
    ).toBe('https://carlab.rs/sr/parts/bmw/');
  });

  it('answers a Make with no page with a 404 the cache keeps like a page', async () => {
    setShop(false);
    stubShop(() => new Response(null, { status: 404 }));
    const response = await respond(
      MakePage,
      new Request('https://carlab.rs/ru/parts/tiny/'),
      { params: { locale: 'ru', make: 'tiny' } },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(NOT_FOUND_PAGE);
  });

  it('asks the visitor to retry, uncached, when the shop fails', async () => {
    setShop(false);
    stubShop(() => new Response(null, { status: 500 }));
    const response = await respond(
      MakePage,
      new Request('https://carlab.rs/ru/parts/bmw/'),
      { params: { locale: 'ru', make: 'bmw' } },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps a preview visitor out of the cache', async () => {
    setShop(false);
    const { response } = hubResponse(undefined, undefined, {
      headers: { cookie: `auto_service_shop_preview=${SHOP_PREVIEW_TOKEN}` },
    });

    expect((await response).headers.get('cache-control')).toBe(
      'private, no-store',
    );
  });

  it.each(['ru', 'sr', 'en'] as const)(
    'links back to the Make page in %s',
    async (locale) => {
      setShop(false);
      vi.mocked(getCollection).mockImplementation((async (name: string) =>
        name === 'works'
          ? [work({ id: 'bmw-x5', make: 'bmw' })]
          : []) as never);
      const page = await hubHtml(undefined, undefined, {
        path: `/${locale}/parts/bmw/`,
      });

      expect(
        page
          .querySelector(`a[href="/${locale}/cars/bmw/"]`)
          ?.textContent?.trim(),
      ).toBe(
        withPlaceholder(
          content(locale).pages.make.headingTemplate,
          'make',
          'BMW',
        ),
      );
    },
  );

  it('links no Make page for a Make the site does not show', async () => {
    setShop(false);
    const page = await hubHtml({ slug: 'tesla', name: 'Tesla' });

    expect(page.querySelector('a[href="/ru/cars/tesla/"]')).toBeNull();
  });
});
