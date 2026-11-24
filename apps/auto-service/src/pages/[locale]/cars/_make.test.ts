import { getCollection } from 'astro:content';
import { withPlaceholder } from '@podbor/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import type { Locale } from '@/i18n/config';
import {
  orangeIn,
  parseHtml,
  partPage,
  respond,
  heroPartsSearch,
  stubShop,
  wirePart,
} from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import type { MakeParts } from '@/utils/works';
import type { Category } from '@podbor/catalog-contract';
import { article } from '@/components/articleFixture';
import { SITE_NAME } from '@/utils/constants';
import type { Article } from '@/utils/blog';
import MakePage from './[make].astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

const category = (slug: string, name: string) =>
  ({
    id: `category_${slug}`,
    slug,
    name,
    text: '',
    translations: { sr: { name: `${name} sr` } },
    maintenance_kit: false,
    kit_rank: 0,
    service_label: null,
    service_price: null,
    service_note: null,
    installation_price: null,
    image: null,
    fields: [],
  }) as unknown as Category;

const showcase = ['HU816X', 'P1'].map((value) =>
  partPage({ slug: `mann-${value.toLowerCase()}`, value }),
);

const bmwParts = (hub = true, shown = showcase): MakeParts => ({
  make: { slug: 'bmw', name: 'BMW' },
  hub,
  showcase: shown,
  categories: [
    'oil-filters',
    'brake-pads',
    'air-filters',
    'spark-plugs',
    'wipers',
    'bulbs',
  ].map((slug) => category(slug, slug.toUpperCase())),
});

let held: MakeParts[] = [];

const withParts = (...entries: MakeParts[]) => {
  held = entries;
};

const PUBLIC_PAGE =
  'public, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=86400';

const shop = stubShopOf(() => held);

function stubShopOf(entries: () => MakeParts[]) {
  return (make: string) => {
    const found = entries().find((entry) => entry.make.slug === make);
    return found
      ? Response.json({
          hub: found.hub,
          categories: found.categories,
          showcase: found.showcase.map(wirePart),
        })
      : new Response(null, { status: 404 });
  };
}

const bmwWorks = Array.from({ length: 7 }, (_, i) =>
  work({ id: `bmw-${i}`, make: 'bmw' }),
);

const works = [
  ...bmwWorks,
  work({ id: 'golf', make: 'volkswagen', published: false }),
  work({ id: 'brakes' }),
];

const overview = (over: Parameters<typeof article>[0] = {}) =>
  article({
    id: 'bmw-overview',
    make: 'bmw',
    overview: true,
    title: 'Ремонт и обслуживание BMW',
    lead: 'Знаем характерные проблемы N47, N20, N55.',
    body: 'Диагностика на ISTA/ISTA+.',
    ...over,
  });

const withArticles = (articles: Article[]) =>
  vi
    .mocked(getCollection)
    .mockImplementation((async (collection: string) =>
      collection === 'articles' ? articles : works) as never);

beforeEach(() => {
  withArticles([]);
  withParts();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const answer = (locale: Locale = 'ru', make = 'bmw', headers = {}) => {
  stubShop((url) => shop(url.pathname.split('/').pop()!));
  return respond(
    MakePage,
    new Request(new URL(`/${locale}/cars/${make}/`, 'https://carlab.rs'), {
      headers,
    }),
    { params: { locale, make } },
  );
};

const page = async (locale: Locale = 'ru', make = 'bmw') =>
  parseHtml(await (await answer(locale, make)).text());
const classes = (element: Element | null) =>
  element ? element.className.split(/\s+/) : [];

const status = async (locale: Locale, make: string) =>
  (await answer(locale, make)).status;

describe('the Make pages', () => {
  it('exist in every locale for a Make with a published Work and for no other', async () => {
    expect(
      await Promise.all(
        (['ru', 'sr', 'en'] as const).map((locale) => status(locale, 'bmw')),
      ),
    ).toEqual([200, 200, 200]);
    expect(await status('ru', 'volkswagen')).toBe(404);
    expect(await status('ru', 'tesla')).toBe(404);
  });

  it('do not exist for a Make with Parts and nothing else', async () => {
    withParts({
      make: { slug: 'audi', name: 'Audi' },
      hub: false,
      categories: [],
      showcase: [],
    });

    expect(await status('ru', 'audi')).toBe(404);
  });

  it('answer a page the cache may keep, without a cookie', async () => {
    const response = await answer();

    expect(response.headers.get('cache-control')).toBe(PUBLIC_PAGE);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect((await answer('ru', 'tesla')).headers.get('cache-control')).toBe(
      PUBLIC_PAGE,
    );
  });

  it('ask the shop for the Make in the locale of the path', async () => {
    const calls = stubShop(() => new Response(null, { status: 404 }));
    await respond(
      MakePage,
      new Request(new URL('/sr/cars/bmw/', 'https://carlab.rs')),
      { params: { locale: 'sr', make: 'bmw' } },
    );
    const [url, init] = calls.mock.calls[0];

    expect(String(url)).toBe('http://shop.test/store/catalogue-pages/cars/bmw');
    expect(new Headers(init?.headers).get('x-catalogue-locale')).toBe('sr');
  });

  it('answer 503 with Retry-After when the shop fails', async () => {
    stubShop(() => new Response(null, { status: 500 }));
    const response = await respond(
      MakePage,
      new Request(new URL('/ru/cars/bmw/', 'https://carlab.rs')),
      { params: { locale: 'ru', make: 'bmw' } },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
  });

  it('answer the numbered list page for a number instead of a Make', async () => {
    const response = await respond(
      MakePage,
      new Request(new URL('/ru/cars/2/', 'https://carlab.rs')),
      { params: { locale: 'ru', make: '2' } },
    );

    expect(response.status).toBe(404);
  });
});

describe('the Parts block of a Make page', () => {
  const partsHeading = (root: Element, locale: Locale = 'ru') =>
    [...root.querySelectorAll('h2')].find(
      (h2) =>
        h2.textContent?.trim() ===
        withPlaceholder(
          content(locale).pages.make.partsHeadingTemplate,
          'make',
          'BMW',
        ),
    );

  it('is absent without a catalogue', async () => {
    const root = await page();

    expect(partsHeading(root)).toBeUndefined();
    expect(root.querySelector('a[href="/ru/parts/bmw/"]')).toBeNull();
  });

  it('is absent when the shop holds no Parts for the Make', async () => {
    withParts({ ...bmwParts(), make: { slug: 'audi', name: 'Audi' } });

    expect(partsHeading(await page())).toBeUndefined();
  });

  it('sits after the services and before the Works', async () => {
    withParts(bmwParts());
    const root = await page();
    const headings = [...root.querySelectorAll('h2')].map((h2) =>
      h2.textContent?.trim(),
    );
    const { make } = content('ru').pages;
    const named = (template: string) =>
      withPlaceholder(template, 'make', 'BMW');

    expect(headings.indexOf(named(make.partsHeadingTemplate))).toBe(
      headings.indexOf(named(make.servicesHeadingTemplate)) + 1,
    );
    expect(headings.indexOf(named(make.worksHeadingTemplate))).toBe(
      headings.indexOf(named(make.partsHeadingTemplate)) + 1,
    );
  });

  it.each([
    ['ru', 'OIL-FILTERS'],
    ['sr', 'OIL-FILTERS sr'],
  ] as const)(
    'links the Categories the shop names for the Make in %s',
    async (locale, first) => {
      withParts(bmwParts());
      const block = partsHeading(await page(locale), locale)!.closest(
        'section',
      )!;
      const categories = [
        ...block.querySelectorAll(`a[href^="/${locale}/parts/c/"]`),
      ];

      expect(categories.map((link) => link.getAttribute('href'))).toEqual(
        [
          'oil-filters',
          'brake-pads',
          'air-filters',
          'spark-plugs',
          'wipers',
          'bulbs',
        ].map((slug) => `/${locale}/parts/c/${slug}/`),
      );
      expect(categories[0].textContent?.trim()).toBe(first);
    },
  );

  it('links the Parts make hub', async () => {
    withParts(bmwParts());
    const block = partsHeading(await page())!.closest('section')!;

    expect(
      block.querySelector('a[href="/ru/parts/bmw/"]')?.textContent?.trim(),
    ).toBe(
      withPlaceholder(content('ru').pages.make.partsHubTemplate, 'make', 'BMW'),
    );
  });

  it('shows the showcase Parts as cards between the Categories and the hub link', async () => {
    withParts(bmwParts());
    const block = partsHeading(await page())!.closest('section')!;
    const cards = [...block.querySelectorAll('a[href^="/ru/parts/p/"]')];
    const all = [...block.querySelectorAll('*')];

    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/ru/parts/p/mann-hu816x/',
      '/ru/parts/p/mann-p1/',
    ]);
    expect(cards[0].textContent).toContain('HU816X');
    expect(all.indexOf(cards[0])).toBeGreaterThan(
      all.indexOf(block.querySelector('a[href^="/ru/parts/c/"]')!),
    );
    expect(all.indexOf(cards[1])).toBeLessThan(
      all.indexOf(block.querySelector('a[href="/ru/parts/bmw/"]')!),
    );
  });

  it('scrolls the Part cards sideways on a phone, as the Works do', async () => {
    withParts(bmwParts());
    const row = partsHeading(await page())!
      .closest('section')!
      .querySelector('a[href^="/ru/parts/p/"]')!
      .closest('ul')!;

    expect(classes(row)).toEqual(
      expect.arrayContaining(['snap-x', 'overflow-x-auto', 'lg:grid']),
    );
  });

  it('rings the whole Part card, not its title, when the card link takes the keyboard focus', async () => {
    withParts(bmwParts());
    const link = partsHeading(await page())!
      .closest('section')!
      .querySelector('a[href^="/ru/parts/p/"]')!;

    expect(classes(link)).toContain('focus-visible:outline-none');
    expect(classes(link.closest('li'))).toEqual(
      expect.arrayContaining([
        'has-[>span>span>a:focus-visible]:outline-3',
        'has-[>span>span>a:focus-visible]:outline-ink',
      ]),
    );
  });

  it('shows no Part cards when the Make has none to show', async () => {
    withParts(bmwParts(true, []));
    const block = partsHeading(await page())!.closest('section')!;

    expect(block.querySelector('a[href^="/ru/parts/p/"]')).toBeNull();
    expect(block.querySelector('a[href^="/ru/parts/c/"]')).not.toBeNull();
  });

  it('links no Parts make hub while the Make has too few Parts for one', async () => {
    withParts(bmwParts(false));
    const block = partsHeading(await page())!.closest('section')!;

    expect(block.querySelector('a[href="/ru/parts/bmw/"]')).toBeNull();
  });
});

describe('the Make pages with Articles', () => {
  it('exist for a Make with an Article and no Work', async () => {
    withArticles([article({ id: 'audi-oil', make: 'audi' })]);

    expect(await status('ru', 'audi')).toBe(200);
  });

  it('leave out a Make whose only Article is unpublished', async () => {
    withArticles([article({ make: 'audi', published: false })]);

    expect(await status('ru', 'audi')).toBe(404);
  });
});

describe('a Make page', () => {
  it.each(['ru', 'sr', 'en'] as const)(
    'heads with the template naming the make in %s',
    async (locale) => {
      const { make } = content(locale).pages;
      const root = await page(locale);

      expect(root.querySelector('h1')?.textContent?.trim()).toBe(
        withPlaceholder(make.headingTemplate, 'make', 'BMW'),
      );
      expect(root.textContent).toContain(
        withPlaceholder(make.leadTemplate, 'make', 'BMW'),
      );
      expect(root.querySelector('title')?.textContent).toBe(
        withPlaceholder(make.metaTitleTemplate, 'make', 'BMW'),
      );
    },
  );

  it('offers the call and the booking, then the services, then the Works', async () => {
    const root = await page();
    const { make } = content('ru').pages;
    const order = [
      root.querySelector('h1')!,
      root.querySelector('[data-contact-placement="hero"]')!,
      [...root.querySelectorAll('h2')].find(
        (h2) =>
          h2.textContent?.trim() ===
          withPlaceholder(make.servicesHeadingTemplate, 'make', 'BMW'),
      )!,
      [...root.querySelectorAll('h2')].find(
        (h2) =>
          h2.textContent?.trim() ===
          withPlaceholder(make.worksHeadingTemplate, 'make', 'BMW'),
      )!,
    ];

    const all = [...root.querySelectorAll('*')];
    const positions = order.map((node) => all.indexOf(node));

    expect(positions).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('lists what the workshop does with a link to each service', async () => {
    const root = await page();

    expect(
      root.querySelector('a[href="/ru/services/diagnostics/"]'),
    ).not.toBeNull();
  });

  it('shows six of the make’s Works and links the Works list narrowed to it', async () => {
    const root = await page();

    expect(root.querySelectorAll('a[href^="/ru/works/bmw-"]')).toHaveLength(6);
    expect(
      root.querySelector('a[href="/ru/works/?make=bmw"]')?.textContent?.trim(),
    ).toBe(
      withPlaceholder(content('ru').pages.make.worksAllTemplate, 'make', 'BMW'),
    );
  });

  it('scrolls the Works sideways on a phone, as the services page does', async () => {
    const row = (await page())
      .querySelector('a[href="/ru/works/bmw-0/"]')!
      .closest('ul')!;

    expect(classes(row)).toEqual(
      expect.arrayContaining(['snap-x', 'overflow-x-auto', 'lg:grid']),
    );
    expect(row.querySelectorAll('li.lg\\:hidden')).toHaveLength(0);
  });

  it('names the make in the heading without an eyebrow repeating it', async () => {
    const hero = (await page()).querySelector(
      '[data-hero-heading]',
    )!.parentElement!;

    expect(hero.querySelector('.eyebrow')).toBeNull();
  });

  it('dials on a touchscreen and offers a callback on a mouse', async () => {
    const hero = (await page()).querySelector(
      '[data-contact-placement="hero"]',
    )!;
    const call = hero.querySelector('a[href^="tel:"]');
    const callback = hero.querySelector('a[data-open-lead-modal="phone"]');

    expect(classes(call)).toContain('pointer-fine:hidden!');
    expect(classes(callback)).toContain('pointer-coarse:hidden!');
  });

  it('shows no questions and no Articles when the Make has none', async () => {
    const root = await page();
    const { make } = content('ru').pages;

    expect(root.textContent).not.toContain(
      withPlaceholder(make.faqHeadingTemplate, 'make', 'BMW'),
    );
    expect(root.querySelector('[data-article-card]')).toBeNull();
    expect(schemaTypes(root)).not.toContain('FAQPage');
  });
});

const schemaTypes = (root: Element) =>
  [...root.querySelectorAll('script[type="application/ld+json"]')].map(
    (script) => JSON.parse(script.textContent!)['@type'] as string,
  );

const headingOf = (root: Element, template: string) =>
  [...root.querySelectorAll('h2')].find(
    (h2) => h2.textContent?.trim() === withPlaceholder(template, 'make', 'BMW'),
  );

describe('a Make page with an overview', () => {
  it('heads with the overview instead of the template', async () => {
    withArticles([overview()]);
    const root = await page();
    const { make } = content('ru').pages;

    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      'Ремонт и обслуживание BMW',
    );
    expect(root.textContent).toContain(
      'Знаем характерные проблемы N47, N20, N55.',
    );
    expect(root.textContent).not.toContain(
      withPlaceholder(make.leadTemplate, 'make', 'BMW'),
    );
    expect(root.querySelector('.prose-shop')?.textContent).toContain(
      'Диагностика на ISTA/ISTA+.',
    );
  });

  it('takes its title and description from the overview', async () => {
    withArticles([overview()]);
    const root = await page();

    expect(root.querySelector('title')?.textContent).toBe(
      `Ремонт и обслуживание BMW | ${SITE_NAME}`,
    );
    expect(
      root.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toBe('Знаем характерные проблемы N47, N20, N55.');
  });

  it('reads the overview in Serbian when it is translated', async () => {
    withArticles([
      overview({
        translations: {
          sr: {
            title: 'Popravka BMW-a',
            lead: 'Poznajemo probleme.',
            body: 'Dijagnostika ISTA.',
          },
        },
      }),
    ]);

    expect((await page('sr')).querySelector('h1')?.textContent?.trim()).toBe(
      'Popravka BMW-a',
    );
  });

  it('answers the overview questions after the Works and marks them up as a FAQPage', async () => {
    withArticles([
      overview({ faq: [{ q: 'Работаете с N47?', a: 'Да, меняем цепь.' }] }),
    ]);
    const root = await page();
    const { make } = content('ru').pages;
    const all = [...root.querySelectorAll('*')];
    const works = headingOf(root, make.worksHeadingTemplate)!;
    const faq = headingOf(root, make.faqHeadingTemplate)!;

    expect(all.indexOf(faq)).toBeGreaterThan(all.indexOf(works));
    expect(root.textContent).toContain('Да, меняем цепь.');
    expect(schemaTypes(root)).toContain('FAQPage');
  });

  it('heads with the later of two overviews', async () => {
    withArticles([
      overview({
        id: 'old',
        title: 'Старый обзор',
        date: new Date('2026-01-01'),
      }),
      overview({
        id: 'new',
        title: 'Новый обзор',
        date: new Date('2026-05-01'),
      }),
    ]);

    expect((await page()).querySelector('h1')?.textContent?.trim()).toBe(
      'Новый обзор',
    );
  });
});

describe('the Articles on a Make page', () => {
  it('come last, newest first, each linking its blog page, without the overview', async () => {
    withArticles([
      overview({ faq: [{ q: 'Вопрос?', a: 'Ответ.' }] }),
      article({ id: 'old', make: 'bmw', date: new Date('2026-01-01') }),
      article({ id: 'new', make: 'bmw', date: new Date('2026-06-01') }),
      article({ id: 'audi', make: 'audi' }),
    ]);
    const root = await page();
    const { make } = content('ru').pages;
    const all = [...root.querySelectorAll('*')];
    const heading = headingOf(root, make.articlesHeadingTemplate)!;
    const cards = [...root.querySelectorAll('[data-article-card]')];

    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/ru/blog/new/',
      '/ru/blog/old/',
    ]);
    expect(all.indexOf(heading)).toBeGreaterThan(
      all.indexOf(headingOf(root, make.faqHeadingTemplate)!),
    );
    expect(all.indexOf(cards[0])).toBeGreaterThan(all.indexOf(heading));
    expect(cards.map((card) => card.querySelector('h2, h3')?.tagName)).toEqual([
      'H3',
      'H3',
    ]);
  });

  it('keeps the overview and the Articles neutral, the booking owns the orange', async () => {
    withArticles([
      overview({ faq: [{ q: 'Вопрос?', a: 'Ответ.' }] }),
      article({ id: 'oil', make: 'bmw' }),
    ]);
    const sections = [
      ...(await page()).querySelectorAll(
        '[data-make-overview], [data-make-faq], [data-make-articles]',
      ),
    ];

    expect(sections).toHaveLength(3);
    expect(sections.flatMap((section) => orangeIn(section))).toEqual([]);
  });
});

describe('the hero of a Make page', () => {
  it('offers the VIN parts search', async () => {
    expect(heroPartsSearch(await page())).not.toBeNull();
  });
});
