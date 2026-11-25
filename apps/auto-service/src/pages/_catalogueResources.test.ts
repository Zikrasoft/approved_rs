import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import type { CataloguePageList } from '@podbor/catalog-contract';
import { SHOP_PREVIEW_TOKEN, stubShop } from '@/components/renderAstro';
import { CATALOGUE_SITEMAP_SIZE } from '@/utils/sitemap';
import * as catalogueBuild from './catalogue-build.json';
import * as rootLlms from './llms.txt';
import * as localeLlms from './[locale]/llms.txt';
import * as sitemapIndex from './sitemap-catalogue.xml';
import * as sitemapChunk from './sitemap-catalogue-[chunk].xml';

vi.mock('astro:content', () => ({ getCollection: vi.fn(async () => []) }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const PUBLIC_PAGE = 'public, s-maxage=86400';

const pageList = (parts: number): CataloguePageList => ({
  parts: Array.from({ length: parts }, (_, index) => ({
    slug: `mann-filter-hu${index}`,
    indexable: index !== 1,
  })),
  makes: [{ slug: 'bmw', name: 'BMW', hub: true, parts: 9 }],
  series: [],
  categories: [{ slug: 'brakes', name: 'Тормоза', listed: 1, demand: null }],
  catalogue_makes: null,
});

const category = {
  id: 'cat_brakes',
  slug: 'brakes',
  name: 'Тормоза',
  text: 'Колодки и диски.',
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: null,
  service_price: null,
  service_note: null,
  installation_price: null,
  image: null,
  fields: [],
};

const shopWith = (parts = 3) =>
  stubShop((url) =>
    url.pathname === '/store/categories'
      ? Response.json({ categories: [category] })
      : Response.json(pageList(parts)),
  );

type Route = { GET: (context: APIContext) => Response | Promise<Response> };

const answer = (
  route: Route,
  path: string,
  {
    params = {},
    headers = {},
  }: { params?: Record<string, string>; headers?: Record<string, string> } = {},
) => {
  const url = new URL(path, 'https://carlab.rs');
  return route.GET({
    url,
    params,
    request: new Request(url, { headers }),
  } as unknown as APIContext);
};

const routes: [string, Route, string, Record<string, string>][] = [
  ['/catalogue-build.json', catalogueBuild, 'application/json', {}],
  ['/llms.txt', rootLlms, 'text/plain; charset=utf-8', {}],
  ['/sr/llms.txt', localeLlms, 'text/plain; charset=utf-8', { locale: 'sr' }],
  [
    '/sitemap-catalogue.xml',
    sitemapIndex,
    'application/xml; charset=utf-8',
    {},
  ],
  [
    '/sitemap-catalogue-0.xml',
    sitemapChunk,
    'application/xml; charset=utf-8',
    { chunk: '0' },
  ],
];

describe.each(routes)('%s', (path, route, type, params) => {
  it('renders on demand, never at build time', () => {
    expect((route as { prerender?: boolean }).prerender).toBe(false);
  });

  it('answers with the public page header the page cache keeps', async () => {
    shopWith();

    const response = await answer(route, path, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(type);
    expect(response.headers.get('cache-control')).toBe(PUBLIC_PAGE);
  });

  it('keeps a preview out of the page cache', async () => {
    shopWith();

    const response = await answer(route, path, {
      params,
      headers: { cookie: `auto_service_shop_preview=${SHOP_PREVIEW_TOKEN}` },
    });

    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});

const shopDown = () => {
  stubShop(() => new Response(null, { status: 500 }));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
};

describe.each(routes.filter(([path]) => !path.endsWith('llms.txt')))(
  '%s',
  (path, route, _type, params) => {
    it('asks to retry, uncached, while the shop is down', async () => {
      shopDown();

      const response = await answer(route, path, { params });

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
    });
  },
);

describe('catalogue-build.json', () => {
  it('counts the Part pages the shop publishes now', async () => {
    shopWith(4);

    const response = await answer(catalogueBuild, '/catalogue-build.json');

    expect(await response.json()).toEqual({ partPages: 4 });
  });
});

describe('llms.txt', () => {
  it('names the Categories the shop has now', async () => {
    shopWith();

    const body = await (await answer(rootLlms, '/llms.txt')).text();

    expect(body).toContain('[Тормоза](https://carlab.rs/sr/parts/c/brakes/)');
  });

  it('answers every locale in its own language', async () => {
    shopWith();

    const body = await (
      await answer(localeLlms, '/en/llms.txt', { params: { locale: 'en' } })
    ).text();

    expect(body).toContain('(https://carlab.rs/en/parts/c/brakes/)');
  });

  it.each([
    ['/llms.txt', rootLlms, {}],
    ['/en/llms.txt', localeLlms, { locale: 'en' }],
  ])(
    'serves %s without the catalogue, briefly cached, while the shop is down',
    async (path, route, params) => {
      shopDown();

      const response = await answer(route, path, { params });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(
        'text/plain; charset=utf-8',
      );
      expect(response.headers.get('cache-control')).toBe('public, s-maxage=60');
      expect(body).toContain('https://carlab.rs/');
      expect(body).not.toContain('/parts/c/');
    },
  );

  it('serves llms.txt while the shop is down even without a shop address', async () => {
    vi.stubEnv('MEDUSA_BACKEND_URL', '');

    const response = await answer(rootLlms, '/llms.txt');

    expect(response.status).toBe(200);
  });

  it('is a 404 for a locale the site does not serve, even while the shop is down', async () => {
    shopDown();

    const response = await answer(localeLlms, '/xx/llms.txt', {
      params: { locale: 'xx' },
    });

    expect(response.status).toBe(404);
  });

  it('is a 404 for a locale the site does not serve', async () => {
    shopWith();

    const response = await answer(localeLlms, '/xx/llms.txt', {
      params: { locale: 'xx' },
    });

    expect(response.status).toBe(404);
  });
});

describe('the catalogue sitemap', () => {
  it('lists one chunk per sitemap size of catalogue URLs', async () => {
    shopWith(CATALOGUE_SITEMAP_SIZE / 3);

    const body = await (
      await answer(sitemapIndex, '/sitemap-catalogue.xml')
    ).text();

    expect(body).toContain('<sitemapindex');
    expect(
      [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc),
    ).toEqual([
      'https://carlab.rs/sitemap-catalogue-0.xml',
      'https://carlab.rs/sitemap-catalogue-1.xml',
    ]);
  });

  it('lists the catalogue pages of a chunk, indexable Parts only', async () => {
    shopWith();

    const body = await (
      await answer(sitemapChunk, '/sitemap-catalogue-0.xml', {
        params: { chunk: '0' },
      })
    ).text();
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      ([, loc]) => loc,
    );

    expect(body).toContain('<urlset');
    expect(locs).toEqual(
      expect.arrayContaining([
        'https://carlab.rs/ru/parts/',
        'https://carlab.rs/sr/parts/makes/',
        'https://carlab.rs/en/parts/c/brakes/',
        'https://carlab.rs/sr/parts/p/mann-filter-hu0/',
      ]),
    );
    expect(locs).not.toContain('https://carlab.rs/sr/parts/p/mann-filter-hu1/');
  });

  it.each(['1', 'x', '-1'])(
    'is a 404 past the last chunk or for %s',
    async (chunk) => {
      shopWith();

      const response = await answer(
        sitemapChunk,
        `/sitemap-catalogue-${chunk}.xml`,
        {
          params: { chunk },
        },
      );

      expect(response.status).toBe(404);
    },
  );
});

describe('robots.txt', () => {
  it('names the catalogue sitemap beside the static one', () => {
    expect(readFileSync('public/robots.txt', 'utf8').split('\n')).toEqual(
      expect.arrayContaining([
        'Sitemap: https://carlab.rs/sitemap-index.xml',
        'Sitemap: https://carlab.rs/sitemap-catalogue.xml',
      ]),
    );
  });
});

describe.each([
  'src/pages/[locale]/services/[slug].astro',
  'src/pages/[locale]/services/index.astro',
  'src/pages/[locale]/works/[slug].astro',
  'src/pages/[locale]/works/index.astro',
])('%s', (file) => {
  it('stays prerendered, reading the Category links at build', () => {
    const source = readFileSync(file, 'utf8');

    expect(source).toContain('getStaticPaths');
    expect(source).not.toMatch(/prerender = false/);
  });
});
