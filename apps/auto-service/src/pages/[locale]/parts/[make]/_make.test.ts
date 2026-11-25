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

vi.mock('astro:content', () => ({ getCollection: vi.fn(async () => []) }));

const PUBLIC_PAGE = 'public, s-maxage=86400';
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
  const shop = stubShop(() => Response.json({ make, series: entries }));
  const [, locale, , slug] = path.split('/');
  return {
    shop,
    response: respond(
      MakePage,
      new Request(new URL(path, 'https://carlab.rs'), { headers }),
      { params: { locale, make: slug } },
    ),
  };
};

const hubHtml = async (...args: Parameters<typeof hubResponse>) =>
  parseHtml(await (await hubResponse(...args).response).text());

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.mocked(getCollection).mockResolvedValue([] as never);
});

describe('the make hub', () => {
  it('names each series with its make and lists its categories', async () => {
    setShop(false);
    const page = await hubHtml({ slug: 'bmw', name: 'BMW' }, [
      series('3 GT', '3-gt', ['Фильтры', 'Тормоза']),
      series('1', '1'),
    ]);
    const rows = [
      ...page.querySelectorAll(`main ul a[href^="/ru/parts/bmw/"]`),
    ];

    expect(
      rows.map((link) => link.querySelector('span, div')?.textContent?.trim()),
    ).toEqual(['BMW 1', 'BMW 3 GT']);
    expect(rows[1].textContent).toContain('Фильтры, Тормоза');
    expect(rows[1].getAttribute('href')).toBe('/ru/parts/bmw/3-gt/');
  });

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
