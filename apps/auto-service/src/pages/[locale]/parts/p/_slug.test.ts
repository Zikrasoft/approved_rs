import {
  partPageSlug,
  type PartPageResponse,
  type RelatedPartPage,
  type Vehicle,
} from '@podbor/catalog-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import {
  offer,
  orangeIn,
  parseHtml,
  wirePage,
  respond,
  setShop,
  SHOP_PREVIEW_TOKEN,
  stubShop,
} from '@/components/renderAstro';
import { PathBuilder } from '@/utils/paths';
import { getCollection } from 'astro:content';
import { BUILT_COVER, work } from '@/components/workFixture';
import PartPage from './[slug].astro';

vi.mock('@/utils/coverImages', (original) =>
  import('@/components/workFixture').then(({ withBuiltCover }) =>
    withBuiltCover(original),
  ),
);

vi.mock('astro:content', () => ({
  getCollection: vi.fn().mockResolvedValue([]),
}));

const copy = content('ru').shopPart;
const pickup = content('ru').shopCart.pickupMethod;

const successor = wirePage({
  id: 'pi_new',
  slug: partPageSlug('bosch', 'NEW1'),
  value: 'NEW 1',
  normalized_value: 'NEW1',
});

const replaced = (over: Partial<RelatedPartPage> = {}) =>
  wirePage({
    part: {
      ...wirePage().part,
      replaced_by: {
        id: 'part_new',
        name: 'Новые колодки',
        translations: null,
        brand_number: {
          id: successor.id,
          type: successor.type,
          value: successor.value,
          normalized_value: successor.normalized_value,
          superseded: false,
          brand: successor.brand,
        },
      },
    },
    ...over,
  });

type PageWire = PartPageResponse['page'];

const pageView = (over: Partial<PageWire> = {}): PageWire => ({
  ...wirePage(),
  indexable: true,
  fits: [],
  requirement_cars: [],
  kit_cars: [],
  ...over,
});

const partPageAnswer = (
  [page, ...related]: (RelatedPartPage | PageWire)[],
  linked: { make: string; slug: string }[] = [],
  vehicles: Vehicle[] = [],
): PartPageResponse => ({
  page: pageView(page),
  related,
  vehicles,
  linked_series: linked,
});

const partPageResponse = (
  pages: (RelatedPartPage | PageWire)[],
  {
    path = `/ru/parts/p/${pages[0].slug}/`,
    headers = {},
    linked = [],
    vehicles = [],
  }: {
    path?: string;
    headers?: Record<string, string>;
    linked?: { make: string; slug: string }[];
    vehicles?: Vehicle[];
  } = {},
) => {
  const shop = stubShop(() =>
    Response.json(partPageAnswer(pages, linked, vehicles)),
  );
  const [, locale, , , slug] = new URL(
    path,
    'https://carlab.rs',
  ).pathname.split('/');
  return {
    shop,
    response: respond(
      PartPage,
      new Request(new URL(path, 'https://carlab.rs'), { headers }),
      { params: { locale, slug } },
    ),
  };
};

const partPageHtml = async (
  pages: (RelatedPartPage | PageWire)[],
  options?: Parameters<typeof partPageResponse>[1],
) => parseHtml(await (await partPageResponse(pages, options).response).text());

const description = (root: Element) =>
  root.querySelector('meta[name="description"]')?.getAttribute('content');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('the part page', () => {
  it('describes the part without prices, orders it and names the pickup while the shop is closed', async () => {
    setShop(false);
    const root = await partPageHtml([wirePage()]);

    expect(description(root)).toBe(copy.metaDescriptionClosed);
    expect(root.textContent).toContain(copy.orderHeading);
    expect(root.textContent).toContain(pickup);
    expect(root.textContent).not.toContain(copy.priceOnRequestHeading);
    expect(root.textContent).not.toContain(copy.priceOnRequestTag);
  });

  it('describes prices and sells the part instead of ordering it once the shop is open', async () => {
    setShop(true);
    const root = await partPageHtml([wirePage({ offers: [offer(3900)] })]);

    expect(description(root)).toBe(copy.metaDescription);
    expect(root.textContent).not.toContain(copy.orderHeading);
  });

  it('orders only the successor of a replaced part while the shop is closed', async () => {
    setShop(false);
    const root = await partPageHtml([replaced(), successor]);

    expect(root.textContent).toContain(copy.successorOrderHeading);
    expect(root.querySelectorAll('parts-list-add[data-slug]')).toHaveLength(1);
    expect(
      root
        .querySelector('parts-list-add[data-slug]')
        ?.getAttribute('data-slug'),
    ).toBe(successor.slug);
  });

  it('sells the priced successor of an unpriced replaced part once the shop is open', async () => {
    setShop(true);
    const root = await partPageHtml([
      replaced(),
      { ...successor, offers: [offer(4100)] },
    ]);

    expect(root.textContent).toContain(copy.successorOffersHeading);
    expect(root.querySelectorAll('part-offers[data-slug]')).toHaveLength(1);
  });

  it('keeps the replaced part on offer beside an unpriced successor once the shop is open', async () => {
    setShop(true);
    const root = await partPageHtml([
      replaced({ offers: [offer(3900)] }),
      successor,
    ]);
    const offered = [...root.querySelectorAll('[data-slug]')].map((node) =>
      node.getAttribute('data-slug'),
    );

    expect(offered).toContain('bosch-0986494524');
    expect(offered).toContain(successor.slug);
  });
});

const equivalentsSection = (root: Element) =>
  [...root.querySelectorAll('section')].find(
    (section) =>
      section.querySelector('h2')?.textContent === copy.equivalentsHeading,
  )!;

const pagesCategory = {
  id: 'cat_pads',
  slug: 'brake-pads',
  name: 'Тормозные колодки',
  text: 'Колодки.',
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

describe('the equivalents of a part', () => {
  it('asks for an equivalent of this part, quietly, when none are listed', async () => {
    setShop(false);
    const section = equivalentsSection(await partPageHtml([wirePage()]));
    const ask = section.querySelector('parts-list-add')!;
    const button = ask.querySelector('a')!;

    expect(section.textContent).toContain(copy.noEquivalents);
    expect(ask.getAttribute('data-slug')).toBe('bosch-0986494524');
    expect(ask.getAttribute('data-number')).toBe('0 986 494 524');
    expect(ask.hasAttribute('data-contact-cta')).toBe(true);
    expect(button.textContent?.trim()).toBe(copy.equivalentsCta);
    expect(button.hasAttribute('data-open-parts-inquiry')).toBe(true);
    expect(button.getAttribute('href')).toBe(
      PathBuilder.partsInquiry('ru', 'Bosch 0 986 494 524'),
    );
    expect(orangeIn(section)).toEqual([]);
  });

  it('lists the equivalents without the ask when there are some', async () => {
    setShop(false);
    const equivalent = {
      ...successor,
      id: 'pi_ate',
      brand: { name: 'ATE', slug: 'ate' },
      value: '13.0460',
      normalized_value: '130460',
      slug: partPageSlug('ate', '130460'),
    };
    const section = equivalentsSection(
      await partPageHtml([
        wirePage({
          equivalents: [
            {
              id: equivalent.id,
              type: equivalent.type,
              value: equivalent.value,
              normalized_value: equivalent.normalized_value,
              superseded: false,
              brand: equivalent.brand,
              images: [],
            },
          ],
        }),
        equivalent,
      ]),
    );

    expect(section.textContent).toContain(copy.equivalentsLead);
    expect(section.querySelector('parts-list-add')).toBeNull();
  });
});

describe('the category block of a part page', () => {
  it('links the whole category in ink, not orange', async () => {
    setShop(false);
    const root = await partPageHtml([wirePage({ category: pagesCategory })]);
    const link = [...root.querySelectorAll('a')].find(
      (anchor) => anchor.textContent?.trim() === copy.categoryLink,
    )!;

    expect(link.getAttribute('href')).toBe('/ru/parts/c/brake-pads/');
    expect(orangeIn(link.parentElement!)).toEqual([]);
  });
});

const PUBLIC_PAGE =
  'public, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=86400';

const PREVIEW_COOKIE_HEADER = {
  cookie: `auto_service_shop_preview=${SHOP_PREVIEW_TOKEN}`,
};

const shopAnswering = (answer: () => Response | Promise<Response>) => {
  stubShop(answer);
  return respond(
    PartPage,
    new Request('https://carlab.rs/ru/parts/p/bosch-0986494524/'),
    { params: { locale: 'ru', slug: 'bosch-0986494524' } },
  );
};

const carIn = (series: string): Vehicle => ({
  id: `vehicle_${series}`,
  slug: null,
  power_kw: 100,
  drive: null,
  market: null,
  year_from: 2015,
  year_to: null,
  steering: null,
  model: {
    slug: `${series}-model`,
    name: `${series} model`,
    chassis: {
      code: series.toUpperCase(),
      body_style: null,
      series: {
        name: series,
        translations: null,
        make: { slug: 'bmw', name: 'BMW' },
      },
    },
  },
  engine: null,
  identifiers: [],
  requirements: [],
});

const fitIn = (series: string) => ({
  part_id: 'part_pads',
  vehicle_id: `vehicle_${series}`,
  quantity: 1,
  axle: null,
  side: null,
  production_from: null,
  production_to: null,
  gearbox: null,
  steering: null,
  note: null,
  translations: null,
});

describe('the Part page rendered on demand', () => {
  it('answers an anonymous visitor with a page the shared cache may keep', async () => {
    setShop(false);
    const response = await partPageResponse([wirePage()]).response;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(PUBLIC_PAGE);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('asks the shop for the page in the locale of the path', async () => {
    setShop(false);
    const { shop, response } = partPageResponse([wirePage()], {
      path: '/sr/parts/p/bosch-0986494524/',
    });
    await response;
    const [url, init] = shop.mock.calls[0];

    expect(String(url)).toBe(
      'http://shop.test/store/catalogue-pages/parts/bosch-0986494524',
    );
    expect(new Headers(init?.headers).get('x-catalogue-locale')).toBe('sr');
  });

  it('answers an unknown slug with a 404 the cache keeps like a page', async () => {
    setShop(false);
    const response = await shopAnswering(
      () => new Response(null, { status: 404 }),
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
      const response = await shopAnswering(answer);

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).toBe(
        content('ru').shopCart.fallbackHeading,
      );
    },
  );

  it('asks the visitor to retry when the site has no shop configured', async () => {
    setShop(false);
    stubShop(() => Response.json({}));
    vi.stubEnv('MEDUSA_BACKEND_URL', '');
    const response = await respond(
      PartPage,
      new Request('https://carlab.rs/ru/parts/p/bosch-0986494524/'),
      { params: { locale: 'ru', slug: 'bosch-0986494524' } },
    );

    expect(response.status).toBe(503);
  });

  it('renders a preview visitor fresh, asking the shop for prices, and keeps it out of the cache', async () => {
    setShop(false);
    const { shop, response } = partPageResponse(
      [wirePage({ offers: [offer(3900)] })],
      { headers: PREVIEW_COOKIE_HEADER },
    );
    const answered = await response;

    expect(answered.status).toBe(200);
    expect(answered.headers.get('cache-control')).toBe('private, no-store');
    expect(
      new Headers(shop.mock.calls[0][1]?.headers).get('x-shop-preview'),
    ).toBe(SHOP_PREVIEW_TOKEN);
  });

  it('renders the prices once the shop is open', async () => {
    setShop(true);
    const root = await partPageHtml([wirePage({ offers: [offer(3900)] })]);

    expect(root.textContent).toMatch(/3[\s.,]?900/);
  });

  it('keeps the canonical, hreflang and noindex of the static page', async () => {
    setShop(false);
    const root = await partPageHtml([pageView({ indexable: false })]);
    const alternates = [
      ...root.querySelectorAll('link[rel="alternate"][hreflang]'),
    ].map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]);

    expect(
      root.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://carlab.rs/ru/parts/p/bosch-0986494524/');
    expect(alternates).toContainEqual([
      'sr',
      'https://carlab.rs/sr/parts/p/bosch-0986494524/',
    ]);
    expect(root.querySelector('meta[name="robots"]')).not.toBeNull();
  });

  it('leaves an indexable Part open to search engines', async () => {
    setShop(false);
    const root = await partPageHtml([wirePage()]);

    expect(root.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('prints no query string, so the cached copy fits every visit', async () => {
    setShop(false);
    const html = await (
      await partPageResponse([wirePage()], {
        path: '/ru/parts/p/bosch-0986494524/?utm_source=visit490&gclid=click490',
      }).response
    ).text();

    expect(html).not.toContain('visit490');
    expect(html).not.toContain('click490');
  });

  it('links a fitted series only when the shop says its page exists', async () => {
    setShop(false);
    const root = await partPageHtml(
      [pageView({ fits: [fitIn('linked'), fitIn('bare')] })],
      {
        linked: [{ make: 'bmw', slug: 'linked' }],
        vehicles: [carIn('linked'), carIn('bare')],
      },
    );
    const hrefs = [...root.querySelectorAll('a')].map((anchor) =>
      anchor.getAttribute('href'),
    );

    expect(hrefs).toContain('/ru/parts/bmw/linked/');
    expect(hrefs).not.toContain('/ru/parts/bmw/bare/');
  });

  it('shows the Works that sourced the Part with the covers the build optimized, as no /_image endpoint runs', async () => {
    setShop(false);
    vi.mocked(getCollection).mockResolvedValueOnce([
      work({ parts: [{ brand: 'Bosch', number: '0 986 494 524' }] }),
    ] as never);
    const root = await partPageHtml([wirePage()]);

    expect(root.querySelector('#works img')?.getAttribute('srcset')).toBe(
      BUILT_COVER.srcset,
    );
    expect(root.innerHTML).not.toContain('/_image');
  });
});
