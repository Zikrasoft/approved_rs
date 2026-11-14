import { getCollection } from 'astro:content';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import facade from '@/assets/workshop-facade.jpg';
import tall from '@/assets/mechanic-engine-teardown-tall.jpg';
import bay from '@/assets/workshop-bay-open-hood.jpg';
import { content } from '@/i18n/content';
import type { Locale } from '@/i18n/config';
import { orangeIn, render } from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import { article } from '@/components/articleFixture';
import { makePartsForBuild } from '@/utils/catalogueEnv';
import type { MakePartsEntry } from '@/utils/catalogueSnapshot';
import { MAKES } from '@/utils/makes';
import type { Article } from '@/utils/blog';
import type { Work } from '@/utils/works';
import CarsIndex, { getStaticPaths } from './[...page].astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));
vi.mock('@/utils/catalogueEnv', async (original) => ({
  ...(await original<typeof import('@/utils/catalogueEnv')>()),
  makePartsForBuild: vi.fn(async () => []),
}));

const { cars } = content('ru').pages;

const source = (works: Work[], articles: Article[] = []) =>
  vi
    .mocked(getCollection)
    .mockImplementation((async (collection: string) =>
      collection === 'articles' ? articles : works) as never);

const worksOn = (count: number) =>
  MAKES.slice(0, count).map(({ slug }) => work({ id: slug, make: slug }));

beforeEach(() => {
  source([]);
  vi.mocked(makePartsForBuild).mockResolvedValue([]);
});

const page = async ({ locale = 'ru' as Locale, number = 1 } = {}) => {
  const path = (await getStaticPaths()).find(
    ({ params }) =>
      params.locale === locale &&
      params.page === (number > 1 ? String(number) : undefined),
  )!;
  return render(CarsIndex as never, {
    path: `/${locale}/cars/${number > 1 ? `${number}/` : ''}`,
    params: path.params,
    props: path.props,
  });
};

const cards = (root: Element) => [
  ...root.querySelectorAll<HTMLElement>('[data-make-card]'),
];

const shown = (root: Element) =>
  cards(root)
    .filter((card) => !card.closest('[hidden]'))
    .map((card) => card.getAttribute('href'));

const searchIndex = (root: Element) =>
  JSON.parse(
    root.querySelector('script[data-search-index]')?.textContent ?? 'null',
  ) as { name: string; href: string; picture: string | null }[];

const picture = (root: Element, make: string) =>
  root
    .querySelector(`[data-make-card][href="/ru/cars/${make}/"] img`)
    ?.getAttribute('src');

describe('the /cars/ list', () => {
  it('lists exactly the Makes that have a page, Parts alone included', async () => {
    source(
      [
        work({ id: 'x3', make: 'bmw' }),
        work({ id: 'golf', make: 'volkswagen', published: false }),
        work({ id: 'no-make' }),
      ],
      [article({ id: 'dsg', make: 'seat' })],
    );
    vi.mocked(makePartsForBuild).mockResolvedValue([
      {
        make: { slug: 'audi', name: 'Audi' },
        parts: 3,
        hub: true,
        categories: [],
      } as MakePartsEntry,
    ]);

    const root = await page();

    expect(shown(root)).toEqual([
      '/ru/cars/audi/',
      '/ru/cars/bmw/',
      '/ru/cars/seat/',
    ]);
    expect(
      cards(root).map((card) => card.querySelector('h2')?.textContent?.trim()),
    ).toEqual(['Audi', 'BMW', 'SEAT']);
  });

  it('builds a first page and one page per 24 Makes in every locale', async () => {
    source(worksOn(25));

    const built = await getStaticPaths();

    expect(
      built
        .filter(({ params }) => params.locale === 'en')
        .map(({ params, props }) => [params.page, props.listing.number]),
    ).toEqual([
      [undefined, 1],
      ['2', 2],
    ]);
    expect(new Set(built.map(({ params }) => params.locale))).toEqual(
      new Set(['ru', 'sr', 'en']),
    );
  });

  it('shows the page its own Makes and links the pages to each other', async () => {
    source(worksOn(25));

    const root = await page({ number: 2 });

    expect(shown(root)).toEqual([`/ru/cars/${MAKES[24].slug}/`]);
    expect(root.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe(
      '/ru/cars/',
    );
    expect(root.querySelector('a[rel="next"]')).toBeNull();
    const pager = root.querySelector(`nav[aria-label="${cars.pagination}"]`)!;
    expect(
      [...pager.querySelectorAll('ol a')].map((a) => a.getAttribute('href')),
    ).toEqual(['/ru/cars/', '/ru/cars/2/']);
    expect(
      pager.querySelector('a[aria-current="page"]')?.textContent?.trim(),
    ).toBe('2');
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      'Машины, страница 2',
    );
  });

  it('renders only its own Makes and hands the search every Make', async () => {
    source(worksOn(25));

    const root = await page();
    const search = root.querySelector('list-search')!;

    expect(cards(root)).toHaveLength(24);
    expect(searchIndex(root)).toHaveLength(25);
    expect(searchIndex(root)[24]).toEqual({
      name: MAKES[24].name,
      href: `/ru/cars/${MAKES[24].slug}/`,
      picture: expect.stringContaining('w=560'),
    });
    expect(search.querySelector('[data-search-input]')).not.toBeNull();
    expect(
      search.querySelector('[data-search-results]')?.hasAttribute('hidden'),
    ).toBe(true);
    const card = search.querySelector<HTMLTemplateElement>(
      'template[data-search-template]',
    )!.content;
    expect(card.querySelector('[data-search-href]')).not.toBeNull();
    expect(card.querySelector('img[data-search-picture]')).not.toBeNull();
    expect(card.querySelector('[data-search-no-picture]')).not.toBeNull();
    expect(card.querySelectorAll('[data-search-name]')).toHaveLength(2);
    expect(
      search.querySelector('[data-search-empty]')?.hasAttribute('hidden'),
    ).toBe(true);
    const idle = [...search.querySelectorAll('[data-search-idle]')];
    expect(
      idle.some((element) => element.querySelector('[data-make-card]')),
    ).toBe(true);
    expect(idle.some((element) => element.querySelector('nav'))).toBe(true);
  });

  it('announces a search with no match through a status that is always there', async () => {
    source(worksOn(2));
    const search = (await page()).querySelector('list-search')!;
    const status = search.querySelector('[data-search-status]');

    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.hasAttribute('hidden')).toBe(false);
    expect(
      search.querySelector('[data-search-empty]')?.hasAttribute('aria-live'),
    ).toBe(false);
  });

  it('offers no pagination when every Make fits one page', async () => {
    source(worksOn(3));

    expect(
      (await page()).querySelector(`nav[aria-label="${cars.pagination}"]`),
    ).toBeNull();
  });

  it('pictures a Make by its overview, else its latest Work, else a placeholder', async () => {
    source(
      [
        work({
          id: 'bmw-old',
          make: 'bmw',
          image: bay,
          date: new Date('2025-01-01'),
        }),
        work({
          id: 'audi-old',
          make: 'audi',
          image: bay,
          date: new Date('2025-01-01'),
        }),
        work({
          id: 'audi-new',
          make: 'audi',
          image: tall,
          date: new Date('2026-01-01'),
        }),
        work({
          id: 'audi-featured',
          make: 'audi',
          image: bay,
          featured: true,
          date: new Date('2024-01-01'),
        }),
      ],
      [
        article({ id: 'bmw', make: 'bmw', overview: true, image: facade }),
        article({ id: 'seat-dsg', make: 'seat' }),
      ],
    );

    const root = await page();

    expect(picture(root, 'bmw')).toContain('workshop-facade');
    expect(picture(root, 'audi')).toContain('mechanic-engine-teardown-tall');
    expect(picture(root, 'seat')).toBeUndefined();
    const indexed = new Map(
      searchIndex(root).map((entry) => [entry.href, entry.picture]),
    );
    expect(indexed.get('/ru/cars/bmw/')).toContain('workshop-facade');
    expect(indexed.get('/ru/cars/audi/')).toContain(
      'mechanic-engine-teardown-tall',
    );
    expect(indexed.get('/ru/cars/seat/')).toBeNull();
    expect(
      root.querySelector('[href="/ru/cars/seat/"] [data-make-placeholder]'),
    ).not.toBeNull();
  });

  it('says there is nothing yet when no Make has a page', async () => {
    const root = await page();

    expect(root.textContent).toContain(cars.empty);
    expect(root.querySelector('list-search')).toBeNull();
  });

  it('speaks the visitor language', async () => {
    source(worksOn(1));

    const root = await page({ locale: 'sr' });
    const { cars: sr } = content('sr').pages;

    expect(shown(root)).toEqual([`/sr/cars/${MAKES[0].slug}/`]);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(sr.heading);
  });

  it('keeps the list neutral, the booking below owns the orange', async () => {
    source(worksOn(2));

    const root = await page();

    expect(orangeIn(root.querySelector('list-search')!)).toEqual([]);
  });
});
