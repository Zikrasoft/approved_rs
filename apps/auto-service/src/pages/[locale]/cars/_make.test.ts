import { getCollection } from 'astro:content';
import { withPlaceholder } from '@podbor/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import type { Locale } from '@/i18n/config';
import { orangeIn, render } from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import { makePartsForBuild } from '@/utils/catalogueEnv';
import type { MakePartsEntry } from '@/utils/catalogueSnapshot';
import type { Category } from '@podbor/catalog-contract';
import { article } from '@/components/articleFixture';
import type { Article } from '@/utils/blog';
import MakePage, { getStaticPaths } from './[make].astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));
vi.mock('@/utils/catalogueEnv', async (original) => ({
  ...(await original<typeof import('@/utils/catalogueEnv')>()),
  makePartsForBuild: vi.fn(async () => []),
}));

const category = (slug: string, name: string) =>
  ({
    id: `category_${slug}`,
    slug,
    name,
    translations: { sr: { name: `${name} sr` } },
  }) as unknown as Category;

const bmwParts = (hub = true): MakePartsEntry => ({
  make: { slug: 'bmw', name: 'BMW' },
  parts: 12,
  hub,
  categories: [
    'oil-filters',
    'brake-pads',
    'air-filters',
    'spark-plugs',
    'wipers',
    'bulbs',
    'belts',
  ].map((slug) => category(slug, slug.toUpperCase())),
});

const withParts = (...entries: MakePartsEntry[]) =>
  vi.mocked(makePartsForBuild).mockResolvedValue(entries);

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

const page = async (locale: Locale = 'ru', make = 'bmw') => {
  const [path] = (await getStaticPaths()).filter(
    ({ params }) => params.locale === locale && params.make === make,
  );
  return render(MakePage as never, {
    path: `/${locale}/cars/${make}/`,
    params: path.params,
    props: path.props,
  });
};
const classes = (element: Element | null) =>
  element ? element.className.split(/\s+/) : [];

describe('the Make pages', () => {
  it('exist in every locale for a Make with a published Work and for no other', async () => {
    expect((await getStaticPaths()).map(({ params }) => params)).toEqual([
      { locale: 'ru', make: 'bmw' },
      { locale: 'sr', make: 'bmw' },
      { locale: 'en', make: 'bmw' },
    ]);
  });

  it('exist for a Make with one published Part and nothing else, and not for a Make the list lacks', async () => {
    withParts(
      {
        make: { slug: 'audi', name: 'Audi' },
        parts: 1,
        hub: false,
        categories: [],
      },
      {
        make: { slug: 'tesla', name: 'Tesla' },
        parts: 4,
        hub: true,
        categories: [],
      },
    );

    expect(
      (await getStaticPaths())
        .filter(({ params }) => params.locale === 'ru')
        .map(({ params }) => params.make),
    ).toEqual(['audi', 'bmw']);
    const audi = await page('ru', 'audi');

    expect(audi.querySelector('h1')?.textContent).toContain('Audi');
    expect(audi.querySelector('a[href="/ru/works/?make=audi"]')).toBeNull();
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

  it('is absent without a catalogue snapshot', async () => {
    const root = await page();

    expect(partsHeading(root)).toBeUndefined();
    expect(root.querySelector('a[href="/ru/parts/bmw/"]')).toBeNull();
  });

  it('is absent when the snapshot holds no Parts for the Make', async () => {
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
    'links the top six Categories of the Make in %s',
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

  it('links no Parts make hub while the Make has too few Parts for one', async () => {
    withParts(bmwParts(false));
    const block = partsHeading(await page())!.closest('section')!;

    expect(block.querySelector('a[href="/ru/parts/bmw/"]')).toBeNull();
  });
});

describe('the Make pages with Articles', () => {
  it('exist for a Make with an Article and no Work', async () => {
    withArticles([article({ id: 'audi-oil', make: 'audi' })]);

    expect(
      (await getStaticPaths())
        .filter(({ params }) => params.locale === 'ru')
        .map(({ params }) => params.make),
    ).toEqual(['audi', 'bmw']);
  });

  it('leave out a Make whose only Article is unpublished', async () => {
    withArticles([article({ make: 'audi', published: false })]);

    expect(
      (await getStaticPaths()).map(({ params }) => params.make),
    ).not.toContain('audi');
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

  it('warns about a second overview and heads with the later one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('bmw'));
    warn.mockRestore();
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
