import { getCollection } from 'astro:content';
import { withPlaceholder } from '@podbor/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import type { Locale } from '@/i18n/config';
import { orangeIn, render } from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import { article } from '@/components/articleFixture';
import type { Article } from '@/utils/blog';
import MakePage, { getStaticPaths } from './[make].astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

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

beforeEach(() => withArticles([]));

const page = async (locale: Locale = 'ru') => {
  const [path] = (await getStaticPaths()).filter(
    ({ params }) => params.locale === locale && params.make === 'bmw',
  );
  return render(MakePage as never, {
    path: `/${locale}/cars/bmw/`,
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

    expect(root.querySelectorAll('[data-filter-item]')).toHaveLength(6);
    expect(
      root.querySelector('a[href="/ru/works/?make=bmw"]')?.textContent?.trim(),
    ).toBe(
      withPlaceholder(content('ru').pages.make.worksAllTemplate, 'make', 'BMW'),
    );
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
