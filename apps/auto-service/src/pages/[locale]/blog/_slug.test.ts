import { getCollection } from 'astro:content';
import { describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { orangeIn, render } from '@/components/renderAstro';
import { article } from '@/components/articleFixture';
import ArticlePage, { getStaticPaths } from './[slug].astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

const { blog } = content('ru');

const page = (current = article(), locale = 'ru') =>
  render(ArticlePage, {
    path: `/${locale}/blog/${current.id}/`,
    params: { locale, slug: current.id },
    props: { article: current },
  });

const schemas = (root: Element) =>
  [...root.querySelectorAll('script[type="application/ld+json"]')].map(
    (script) => JSON.parse(script.textContent!) as Record<string, unknown>,
  );

describe('the article pages', () => {
  it('give every published Article a page in every locale, but not an overview', async () => {
    vi.mocked(getCollection).mockResolvedValue([
      article({ id: 'oil' }),
      article({ id: 'draft', published: false }),
      article({ id: 'bmw', make: 'bmw', overview: true }),
    ] as never);

    expect(
      (await getStaticPaths()).map(({ params }) => [
        params.locale,
        params.slug,
      ]),
    ).toEqual([
      ['ru', 'oil'],
      ['sr', 'oil'],
      ['en', 'oil'],
    ]);
  });
});

describe('an article page', () => {
  it('heads the page with the title, then the lead and the text', async () => {
    const root = await page();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      'Когда менять масло',
    );
    expect(root.textContent).toContain('Коротко о сроках замены масла.');
    expect(root.querySelector('.prose-shop')?.textContent).toContain(
      'Масло меняем раз в год.',
    );
    expect(root.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-10-01',
    );
  });

  it('renders no empty text block for an Article with a lead alone', async () => {
    const root = await page(article({ body: '  ' }));

    expect(root.querySelector('.prose-shop')).toBeNull();
    expect(root.textContent).toContain('Коротко о сроках замены масла.');
  });

  it('links back to the blog in its crumbs', async () => {
    const crumbs = [
      ...(await page()).querySelectorAll('nav[aria-label] ol a'),
    ].map((link) => link.getAttribute('href'));

    expect(crumbs).toContain('/ru/blog/');
  });

  it('links an Article about a Make to that Make page', async () => {
    const link = (await page(article({ make: 'bmw' }))).querySelector(
      'a[href="/ru/cars/bmw/"]',
    );

    expect(link?.textContent?.trim()).toBe('Ремонт BMW в CarLab');
  });

  it('links an Article about no Make to no Make page', async () => {
    expect(
      (await page()).querySelector(
        'a[href^="/ru/cars/"]:not([href="/ru/cars/"])',
      ),
    ).toBeNull();
  });

  it('answers its frequent questions and marks them up for search', async () => {
    const root = await page(
      article({ faq: [{ q: 'Сколько стоит?', a: 'От 5000 RSD.' }] }),
    );

    expect(root.textContent).toContain(blog.faqHeading);
    expect(root.textContent).toContain('От 5000 RSD.');
    expect(schemas(root)).toContainEqual(
      expect.objectContaining({ '@type': 'FAQPage' }),
    );
  });

  it('shows no questions block when the Article has none', async () => {
    const root = await page();

    expect(root.textContent).not.toContain(blog.faqHeading);
    expect(schemas(root).map((schema) => schema['@type'])).not.toContain(
      'FAQPage',
    );
  });

  it('describes itself as an Article for search engines', async () => {
    expect(schemas(await page())).toContainEqual(
      expect.objectContaining({
        '@type': 'Article',
        headline: 'Когда менять масло',
        description: 'Коротко о сроках замены масла.',
        datePublished: '2026-10-01T00:00:00.000Z',
        mainEntityOfPage: 'https://carlab.rs/ru/blog/oil-change/',
      }),
    );
  });

  it('reads in Serbian when the translation exists', async () => {
    const root = await page(
      article({
        translations: {
          sr: {
            title: 'Kada menjati ulje',
            body: 'Ulje menjamo jednom godišnje.',
            lead: 'Ukratko o rokovima.',
          },
        },
      }),
      'sr',
    );

    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      'Kada menjati ulje',
    );
    expect(root.textContent).toContain('Ukratko o rokovima.');
  });

  it('falls back to Russian where the translation is missing', async () => {
    const root = await page(article(), 'en');

    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      'Когда менять масло',
    );
  });

  it('keeps the text and its Make link neutral, the booking below owns the orange', async () => {
    const root = await page(
      article({ make: 'bmw', faq: [{ q: 'Сколько?', a: 'Час.' }] }),
    );

    expect(orangeIn(root.querySelector('article')!)).toEqual([]);
  });
});
