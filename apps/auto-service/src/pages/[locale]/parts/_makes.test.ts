import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseHtml,
  respond,
  setShop,
  SHOP_PREVIEW_TOKEN,
  stubShop,
} from '@/components/renderAstro';
import MakesPage from './makes.astro';

const PUBLIC_PAGE = 'public, s-maxage=86400';

const makesResponse = (
  makes = [
    { slug: 'bmw', name: 'BMW' },
    { slug: 'audi', name: 'Audi' },
    { slug: 'alfa-romeo', name: 'Alfa Romeo' },
  ],
  { path = '/ru/parts/makes/', headers = {} } = {},
) => {
  const shop = stubShop(() => Response.json({ makes }));
  return {
    shop,
    response: respond(
      MakesPage,
      new Request(new URL(path, 'https://carlab.rs'), { headers }),
      { params: { locale: path.split('/')[1] } },
    ),
  };
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('the makes list rendered on demand', () => {
  it('groups the Makes by letter with a link to each hub', async () => {
    setShop(false);
    const page = parseHtml(await (await makesResponse().response).text());

    expect(
      [...page.querySelectorAll('main h2')].map((h) => h.textContent?.trim()),
    ).toEqual(['A', 'B']);
    expect(
      [...page.querySelectorAll('main h2 + ul a')].map((a) => [
        a.getAttribute('href'),
        a.textContent?.trim(),
      ]),
    ).toEqual([
      ['/ru/parts/alfa-romeo/', 'Alfa Romeo'],
      ['/ru/parts/audi/', 'Audi'],
      ['/ru/parts/bmw/', 'BMW'],
    ]);
  });

  it('asks the shop in the locale of the path and answers a page the cache may keep', async () => {
    setShop(false);
    const { shop, response } = makesResponse(undefined, {
      path: '/sr/parts/makes/',
    });
    const answered = await response;
    const [url, init] = shop.mock.calls[0];

    expect(String(url)).toBe('http://shop.test/store/catalogue-pages/makes');
    expect(new Headers(init?.headers).get('x-catalogue-locale')).toBe('sr');
    expect(answered.status).toBe(200);
    expect(answered.headers.get('cache-control')).toBe(PUBLIC_PAGE);
    expect(answered.headers.get('set-cookie')).toBeNull();
  });

  it('keeps canonical and hreflang of the static page', async () => {
    setShop(false);
    const page = parseHtml(await (await makesResponse().response).text());

    expect(
      page.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://carlab.rs/ru/parts/makes/');
    expect(
      page
        .querySelector('link[rel="alternate"][hreflang="en"]')
        ?.getAttribute('href'),
    ).toBe('https://carlab.rs/en/parts/makes/');
    expect(
      page.querySelector('meta[name="robots"][content*="noindex"]'),
    ).toBeNull();
  });

  it('asks the visitor to retry, uncached, when the shop fails', async () => {
    setShop(false);
    stubShop(() => new Response(null, { status: 500 }));
    const response = await respond(
      MakesPage,
      new Request('https://carlab.rs/ru/parts/makes/'),
      { params: { locale: 'ru' } },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps a preview visitor out of the cache', async () => {
    setShop(false);
    const { response } = makesResponse(undefined, {
      headers: { cookie: `auto_service_shop_preview=${SHOP_PREVIEW_TOKEN}` },
    });

    expect((await response).headers.get('cache-control')).toBe(
      'private, no-store',
    );
  });

  it('renders an empty list when the shop knows no Make page', async () => {
    setShop(false);
    stubShop(() => new Response(null, { status: 404 }));
    const response = await respond(
      MakesPage,
      new Request('https://carlab.rs/ru/parts/makes/'),
      { params: { locale: 'ru' } },
    );

    expect(response.status).toBe(200);
    expect(
      parseHtml(await response.text()).querySelectorAll('main h2'),
    ).toHaveLength(0);
  });
});
