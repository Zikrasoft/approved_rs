import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  orangeIn,
  parseHtml,
  partPage,
  respond,
  setShop,
  SHOP_PREVIEW_TOKEN,
  stubShop,
  wirePart,
} from '@/components/renderAstro';
import { content } from '@/i18n/content';
import type { PartPageEntry } from '@/utils/catalogueSnapshot';
import CategoryPage from './[...page].astro';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const PUBLIC_PAGE =
  'public, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=86400';

const category = {
  id: 'cat_batteries',
  slug: 'batteries',
  name: 'Аккумуляторы',
  text: 'Стартерные аккумуляторы.',
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

const bmw = { slug: 'bmw', name: 'BMW' };
const mercedes = { slug: 'mercedes-benz', name: 'Mercedes-Benz' };

const cars = [
  {
    make: bmw,
    series: [{ name: '3 серия', slug: '3-series', translations: null }],
  },
  {
    make: mercedes,
    series: [
      {
        name: 'E-Класс',
        slug: 'e-class',
        translations: { en: { name: 'E-Class' } },
      },
    ],
  },
];

type Answer = {
  entries?: PartPageEntry[];
  popular?: PartPageEntry[];
  page?: number;
  pages?: number;
  count?: number;
  cars?: unknown[];
  demanded?: boolean;
  uniform?: string[];
  ranges?: unknown[];
  fields?: unknown[];
};

const answerOf = ({
  entries = [],
  popular = [],
  count = entries.length,
  fields = [],
  ...over
}: Answer) => ({
  category: { ...category, fields },
  page: 1,
  pages: 1,
  count,
  entries: entries.map(wirePart),
  popular: popular.map(wirePart),
  facets: [],
  ranges: [],
  uniform: [],
  demanded: false,
  cars: [],
  ...over,
});

const categoryResponse = (
  answer: Answer,
  {
    path = '/ru/parts/c/batteries/',
    headers = {},
  }: { path?: string; headers?: Record<string, string> } = {},
) => {
  const shop = stubShop(() => Response.json(answerOf(answer)));
  const [, locale, , , slug, page] = new URL(
    path,
    'https://carlab.rs',
  ).pathname.split('/');
  return {
    shop,
    response: respond(
      CategoryPage,
      new Request(new URL(path, 'https://carlab.rs'), { headers }),
      { params: { locale, slug, ...(page && { page }) } },
    ),
  };
};

const categoryPage = async (
  answer: Answer,
  options?: Parameters<typeof categoryResponse>[1],
) => {
  setShop(true);
  return parseHtml(
    await (await categoryResponse(answer, options).response).text(),
  );
};

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

describe('the car picker on a category page', () => {
  it('offers the makes and their series that have a page in the category', async () => {
    const doc = await categoryPage({ entries: [partPage()], cars });
    const picker = doc.querySelector('car-picker')!;
    expect(text(picker.querySelector('h2'))).toBe('Для моего авто');
    expect(picker.getAttribute('data-href')).toBe(
      '/ru/parts/{make}/{series}/batteries/',
    );
    expect(
      [...picker.querySelectorAll('[name=make] option')].map((option) => [
        option.getAttribute('value'),
        text(option),
      ]),
    ).toEqual([
      ['', 'Любая марка'],
      ['bmw', 'BMW'],
      ['mercedes-benz', 'Mercedes-Benz'],
    ]);
    expect(
      [...picker.querySelectorAll('[name=series] optgroup')].map((group) => [
        group.getAttribute('data-make'),
        [...group.querySelectorAll('option')].map((option) => [
          option.getAttribute('value'),
          text(option),
        ]),
      ]),
    ).toEqual([
      ['bmw', [['3-series', '3 серия']]],
      ['mercedes-benz', [['e-class', 'E-Класс']]],
    ]);
  });

  it('falls back to the category search without JavaScript', async () => {
    const doc = await categoryPage({ entries: [partPage()], cars });
    const form = doc.querySelector('car-picker form')!;
    expect(form.getAttribute('action')).toBe('/ru/parts/search/');
    expect(form.getAttribute('method')).toBe('GET');
    expect(
      form.querySelector('input[name=category]')?.getAttribute('value'),
    ).toBe('batteries');
    expect(form.querySelector('[name=series]')?.hasAttribute('required')).toBe(
      true,
    );
  });

  it('leaves the orange to the contact actions, since it only filters', async () => {
    const doc = await categoryPage({ entries: [partPage()], cars });
    expect(orangeIn(doc.querySelector('car-picker')!)).toEqual([]);
  });

  it('is left out when no series has a page in the category', async () => {
    const doc = await categoryPage({ entries: [partPage()] });
    expect(doc.querySelector('car-picker')).toBeNull();
  });

  it('is left out of an empty category', async () => {
    const doc = await categoryPage({ cars });
    expect(doc.querySelector('car-picker')).toBeNull();
  });
});

describe('an empty category', () => {
  it('ends on the inquiry card without a full band of padding under it', async () => {
    const doc = await categoryPage({ cars });
    const section = doc.querySelector('#inquiry')!.parentElement!;
    expect(section.classList).not.toContain('pb-band');
    expect(section.classList).not.toContain('md:py-band-lg');
  });
});

describe('demand on a category page', () => {
  const demanded = (id: string, score: number, top: boolean) =>
    partPage({
      id,
      slug: `bosch-${id}`,
      value: id,
      demand: { score, popular: true, top },
      part: { ...partPage().part, id: `part_${id}` },
    });
  const headings = (doc: Element) =>
    [...doc.querySelectorAll('h2')].map((heading) => text(heading));

  it('shows what is often ordered in the category and badges its top parts', async () => {
    const picks = [demanded('a', 6, false), demanded('b', 9, true)];
    const doc = await categoryPage({ entries: picks, popular: picks });

    expect(headings(doc)).toContain('Часто заказывают');
    expect(doc.querySelectorAll('[data-demand-badge]').length).toBeGreaterThan(
      0,
    );
  });

  it('shows no block for a single popular part', async () => {
    const doc = await categoryPage({
      entries: [demanded('a', 6, false), partPage()],
      popular: [demanded('a', 6, false)],
    });

    expect(headings(doc)).not.toContain('Часто заказывают');
  });

  it('offers the popular order on the search beside its own', async () => {
    const doc = await categoryPage({
      entries: [partPage(), demanded('a', 6, false)],
      demanded: true,
    });
    const orders = [...doc.querySelectorAll('nav[aria-label="Порядок"] a')].map(
      (link) => [link.getAttribute('href'), link.getAttribute('aria-current')],
    );

    expect(orders).toEqual([
      ['/ru/parts/c/batteries/', 'page'],
      ['/ru/parts/search/?category=batteries&sort=popular', null],
    ]);
  });

  it('offers no popular order while nothing in the category is demanded', async () => {
    const doc = await categoryPage({
      entries: [partPage(), partPage({ id: 'pi_ate', slug: 'ate-1' })],
    });

    expect(doc.querySelector('nav[aria-label="Порядок"]')).toBeNull();
  });
});

describe('the whole Category behind one listing page', () => {
  const field = (key: string, type: string, extra = {}) => ({
    key,
    type,
    unit: null,
    label: key,
    translations: null,
    required: false,
    facet: false,
    rank: 0,
    options: [],
    ...extra,
  });

  it('hides a key spec the shop says every part shares', async () => {
    const entries = [
      partPage({
        part: {
          ...partPage().part,
          attributes: { voltage: '12', capacity: '60' },
        },
      }),
    ];
    const doc = await categoryPage({
      entries,
      count: 2,
      uniform: ['voltage'],
      fields: [field('voltage', 'text'), field('capacity', 'text')],
    });
    const row = text(doc.querySelector('ul.card li'))!;

    expect(row).toContain('60');
    expect(row).not.toContain('12');
  });

  it('prints the range of a number field from the shop', async () => {
    const doc = await categoryPage({
      entries: [partPage()],
      ranges: [{ key: 'capacity', min: 40, max: 95 }],
      fields: [field('capacity', 'number', { label: 'Емкость' })],
    });
    const row = [...doc.querySelectorAll('dl > div')].find((item) =>
      text(item)?.startsWith('Емкость'),
    );

    expect(text(row)).toMatch(/40.*95/);
  });

  it('links the pages around this one with the numbers of the shop', async () => {
    const doc = await categoryPage(
      { entries: [partPage()], page: 2, pages: 3, count: 100 },
      { path: '/ru/parts/c/batteries/2/' },
    );

    expect(doc.querySelector('link[rel="prev"]')?.getAttribute('href')).toBe(
      '/ru/parts/c/batteries/',
    );
    expect(doc.querySelector('link[rel="next"]')?.getAttribute('href')).toBe(
      '/ru/parts/c/batteries/3/',
    );
    expect(
      doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://carlab.rs/ru/parts/c/batteries/2/');
  });
});

describe('the Category page rendered on demand', () => {
  it('answers an anonymous visitor with a page the shared cache may keep, without a cookie', async () => {
    setShop(false);
    const response = await categoryResponse({ entries: [partPage()] }).response;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(PUBLIC_PAGE);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('asks the shop for the page and the locale of the path', async () => {
    setShop(false);
    const { shop, response } = categoryResponse(
      { entries: [partPage()], page: 3, pages: 3 },
      { path: '/sr/parts/c/batteries/3/' },
    );
    await response;
    const [url, init] = shop.mock.calls[0];

    expect(String(url)).toBe(
      'http://shop.test/store/catalogue-pages/categories/batteries?page=3',
    );
    expect(new Headers(init?.headers).get('x-catalogue-locale')).toBe('sr');
  });

  it.each(['/ru/parts/c/batteries/1/', '/ru/parts/c/batteries/02/'])(
    'answers %s with a 404 without asking the shop',
    async (path) => {
      setShop(false);
      const { shop, response } = categoryResponse({}, { path });
      const answered = await response;

      expect(answered.status).toBe(404);
      expect(shop).not.toHaveBeenCalled();
    },
  );

  it('answers a page the shop does not know with a 404 the cache keeps like a page', async () => {
    setShop(false);
    stubShop(() => new Response(null, { status: 404 }));
    const response = await respond(
      CategoryPage,
      new Request('https://carlab.rs/ru/parts/c/batteries/9/'),
      { params: { locale: 'ru', slug: 'batteries', page: '9' } },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(PUBLIC_PAGE);
  });

  it.each([
    ['answers 500', () => new Response(null, { status: 500 })],
    [
      'times out',
      () => Promise.reject(new DOMException('timed out', 'TimeoutError')),
    ],
  ])(
    'asks the visitor to retry, uncached, when the shop %s',
    async (_name, answer) => {
      setShop(false);
      stubShop(answer);
      const response = await respond(
        CategoryPage,
        new Request('https://carlab.rs/ru/parts/c/batteries/'),
        { params: { locale: 'ru', slug: 'batteries' } },
      );

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).toBe(
        content('ru').shopCart.fallbackHeading,
      );
    },
  );

  it('renders a preview visitor fresh, asking the shop for prices, and keeps it out of the cache', async () => {
    setShop(false);
    const { shop, response } = categoryResponse(
      { entries: [partPage()] },
      {
        headers: {
          cookie: `auto_service_shop_preview=${SHOP_PREVIEW_TOKEN}`,
        },
      },
    );
    const answered = await response;

    expect(answered.headers.get('cache-control')).toBe('private, no-store');
    expect(
      new Headers(shop.mock.calls[0][1]?.headers).get('x-shop-preview'),
    ).toBe(SHOP_PREVIEW_TOKEN);
  });

  it('keeps the canonical and hreflang of the static page, and leaves it open to search engines', async () => {
    const doc = await categoryPage({ entries: [partPage()] });
    const alternates = [
      ...doc.querySelectorAll('link[rel="alternate"][hreflang]'),
    ].map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]);

    expect(
      doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://carlab.rs/ru/parts/c/batteries/');
    expect(alternates).toContainEqual([
      'sr',
      'https://carlab.rs/sr/parts/c/batteries/',
    ]);
    expect(doc.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('prints no query string, so the cached copy fits every visit', async () => {
    setShop(false);
    const html = await (
      await categoryResponse(
        { entries: [partPage()] },
        { path: '/ru/parts/c/batteries/?utm_source=visit491&gclid=click491' },
      ).response
    ).text();

    expect(html).not.toContain('visit491');
    expect(html).not.toContain('click491');
  });
});
