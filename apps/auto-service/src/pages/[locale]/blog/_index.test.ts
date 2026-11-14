import { getCollection } from 'astro:content';
import { describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { orangeIn, render } from '@/components/renderAstro';
import { article } from '@/components/articleFixture';
import BlogIndex, { getStaticPaths } from './[...page].astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

const { blog } = content('ru');

const articles = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    article({
      id: `a${index + 1}`,
      title: `Статья ${index + 1}`,
      date: new Date(2026, 0, count - index),
    }),
  );

const paths = async (entries: ReturnType<typeof article>[]) => {
  vi.mocked(getCollection).mockResolvedValue(entries as never);
  return getStaticPaths();
};

const page = async (
  entries: ReturnType<typeof article>[],
  { locale = 'ru', number = 1 } = {},
) => {
  const path = (await paths(entries)).find(
    ({ params }) =>
      params.locale === locale &&
      params.page === (number > 1 ? String(number) : undefined),
  )!;
  return render(BlogIndex, {
    path: `/${locale}/blog/${number > 1 ? `${number}/` : ''}`,
    params: path.params,
    props: path.props,
  });
};

const hrefs = (root: Element, selector: string) =>
  [...root.querySelectorAll(selector)].map((link) => link.getAttribute('href'));

describe('the blog list', () => {
  it('builds a first page and one page per twelve Articles in every locale', async () => {
    const built = await paths(articles(13));

    expect(
      built
        .filter(({ params }) => params.locale === 'sr')
        .map(({ params, props }) => [params.page, props.listing.items.length]),
    ).toEqual([
      [undefined, 12],
      ['2', 1],
    ]);
    expect(new Set(built.map(({ params }) => params.locale))).toEqual(
      new Set(['ru', 'sr', 'en']),
    );
  });

  it('lists the Articles newest first with a picture, a lead and a link to each', async () => {
    const root = await page(articles(2));
    const cards = [...root.querySelectorAll('[data-article-card]')];

    expect(hrefs(root, '[data-article-card]')).toEqual([
      '/ru/blog/a1/',
      '/ru/blog/a2/',
    ]);
    expect(cards[0].querySelector('img')).not.toBeNull();
    expect(cards[0].textContent).toContain('Коротко о сроках замены масла.');
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(blog.heading);
  });

  it('leaves an overview out of the list', async () => {
    const root = await page([
      article({ id: 'bmw', overview: true, make: 'bmw' }),
      article({ id: 'oil' }),
    ]);

    expect(hrefs(root, '[data-article-card]')).toEqual(['/ru/blog/oil/']);
  });

  it('links the pages of a long list to each other', async () => {
    const root = await page(articles(13), { number: 2 });

    expect(hrefs(root, '[data-article-card]')).toEqual(['/ru/blog/a13/']);
    expect(root.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe(
      '/ru/blog/',
    );
    expect(root.querySelector('a[rel="next"]')).toBeNull();
    const pager = `nav[aria-label="${blog.pagination}"]`;
    expect(hrefs(root, `${pager} ol a`)).toEqual(['/ru/blog/', '/ru/blog/2/']);
    expect(
      root
        .querySelector(`${pager} a[aria-current="page"]`)
        ?.textContent?.trim(),
    ).toBe('2');
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      'Блог, страница 2',
    );
  });

  it('offers no pagination when everything fits one page', async () => {
    expect(
      (await page(articles(3))).querySelector(
        `nav[aria-label="${blog.pagination}"]`,
      ),
    ).toBeNull();
  });

  it('says there is nothing yet when no Article is published', async () => {
    const root = await page([]);

    expect(root.textContent).toContain(blog.empty);
    expect(root.querySelector('[data-article-card]')).toBeNull();
  });

  it('shows the translated title, and the Russian one while it is missing', async () => {
    const root = await page(
      [
        article({
          id: 'oil',
          translations: {
            sr: { title: 'Kada menjati ulje', body: 'Tekst.', lead: 'Kratko.' },
          },
        }),
        article({
          id: 'brakes',
          title: 'Тормоза',
          date: new Date('2026-01-01'),
        }),
      ],
      { locale: 'sr' },
    );
    const titles = [...root.querySelectorAll('[data-article-card] h2')].map(
      (title) => title.textContent?.trim(),
    );

    expect(titles).toEqual(['Kada menjati ulje', 'Тормоза']);
    expect(hrefs(root, '[data-article-card]')).toEqual([
      '/sr/blog/oil/',
      '/sr/blog/brakes/',
    ]);
  });

  it('keeps the list neutral, the booking below owns the orange', async () => {
    const root = await page(articles(2));
    const list = root.querySelector('[data-article-card]')!.closest('section')!;

    expect(orangeIn(list)).toEqual([]);
  });
});
