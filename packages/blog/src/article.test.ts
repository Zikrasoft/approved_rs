import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  articleSchema,
  blogListed,
  blogPages,
  localizedArticle,
  makeArticles,
  type ArticleEntry,
} from './article.ts';

const schema = articleSchema({ image: z.string(), makes: ['bmw', 'audi'] });
const written = {
  title: 'Когда менять масло',
  lead: 'Коротко о сроках.',
  date: '2026-11-01',
  image: 'cover.jpg',
};

describe('the Article schema', () => {
  it('reads an Article about no Make as a published blog text', () => {
    expect(schema.parse(written)).toEqual({
      ...written,
      date: new Date('2026-11-01'),
      overview: false,
      faq: [],
      published: true,
    });
  });

  it('keeps the Make, the overview flag and the frequent questions', () => {
    const faq = [{ q: 'Сколько стоит?', a: 'От 5000 RSD.' }];
    expect(
      schema.parse({ ...written, make: 'bmw', overview: true, faq }),
    ).toMatchObject({ make: 'bmw', overview: true, faq });
  });

  it('refuses an overview about no Make, which no page would show', () => {
    const parsed = schema.safeParse({ ...written, overview: true });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(['make']);
  });

  it('refuses a Make the catalogue does not know', () => {
    expect(schema.safeParse({ ...written, make: 'tesla' }).success).toBe(false);
  });

  it.each(['title', 'lead'])('refuses a blank %s', (field) => {
    expect(schema.safeParse({ ...written, [field]: '  ' }).success).toBe(false);
  });

  it('refuses an Article without a picture', () => {
    const { image: _, ...noImage } = written;
    expect(schema.safeParse(noImage).success).toBe(false);
  });

  it('accepts the translations the translate job writes', () => {
    const translations = {
      sr: { title: 'Kada menjati ulje', body: 'Tekst.', lead: 'Ukratko.' },
    };
    expect(schema.parse({ ...written, translations }).translations).toEqual(
      translations,
    );
  });
});

const entry = (
  id: string,
  date: string,
  data: Partial<ArticleEntry['data']> = {},
): ArticleEntry => ({
  id,
  body: `Текст ${id}`,
  data: {
    title: id,
    lead: `Лид ${id}`,
    date: new Date(date),
    overview: false,
    published: true,
    faq: [],
    ...data,
  },
});

describe('the blog list', () => {
  it('pages the published Articles newest first, without overviews', () => {
    const pages = blogPages(
      [
        entry('old', '2026-01-01'),
        entry('draft', '2026-05-01', { published: false }),
        entry('bmw', '2026-06-01', { overview: true, make: 'bmw' }),
        entry('new', '2026-03-01'),
        entry('mid', '2026-02-01'),
      ],
      2,
    );

    expect(
      pages.map(({ number, count, items }) => ({
        number,
        count,
        ids: items.map(({ id }) => id),
      })),
    ).toEqual([
      { number: 1, count: 2, ids: ['new', 'mid'] },
      { number: 2, count: 2, ids: ['old'] },
    ]);
  });

  it('still has its first page when there is no Article yet', () => {
    expect(blogPages([], 12)).toEqual([{ number: 1, count: 1, items: [] }]);
  });

  it('is worth linking once it lists a published Article that is no overview', () => {
    expect(blogListed([entry('new', '2026-03-01')])).toBe(true);
    expect(
      blogListed([
        entry('bmw', '2026-06-01', { overview: true, make: 'bmw' }),
        entry('draft', '2026-05-01', { published: false }),
      ]),
    ).toBe(false);
    expect(blogListed([])).toBe(false);
  });
});

describe('the Articles of a Make page', () => {
  const ids = ({ overview, articles }: ReturnType<typeof makeArticles>) => ({
    overview: overview?.id,
    articles: articles.map(({ id }) => id),
  });

  it('heads the page with the overview and lists the rest newest first', () => {
    expect(
      ids(
        makeArticles([
          entry('old', '2026-01-01', { make: 'bmw' }),
          entry('overview', '2026-02-01', { make: 'bmw', overview: true }),
          entry('new', '2026-03-01', { make: 'bmw' }),
        ]),
      ),
    ).toEqual({ overview: 'overview', articles: ['new', 'old'] });
  });

  it('has no overview when none is marked', () => {
    expect(
      ids(makeArticles([entry('oil', '2026-01-01', { make: 'bmw' })])),
    ).toEqual({ overview: undefined, articles: ['oil'] });
  });

  it('leaves out an unpublished Article and an unpublished overview', () => {
    expect(
      ids(
        makeArticles([
          entry('draft', '2026-01-01', { make: 'bmw', published: false }),
          entry('hidden', '2026-02-01', {
            make: 'bmw',
            overview: true,
            published: false,
          }),
        ]),
      ),
    ).toEqual({ overview: undefined, articles: [] });
  });

  it('uses the later of two overviews of one Make and hands back the other', () => {
    const { overview, ignoredOverviews } = makeArticles([
      entry('first', '2026-01-01', { make: 'bmw', overview: true }),
      entry('second', '2026-03-01', { make: 'bmw', overview: true }),
    ]);

    expect(overview?.id).toBe('second');
    expect(ignoredOverviews.map(({ id }) => id)).toEqual(['first']);
  });

  it('ignores no overview when there is a single one', () => {
    expect(
      makeArticles([
        entry('one', '2026-01-01', { make: 'bmw', overview: true }),
      ]).ignoredOverviews,
    ).toEqual([]);
  });
});

describe('a localized Article', () => {
  const faq = [{ q: 'Сколько стоит?', a: 'От 5000 RSD.' }];
  const sr = {
    title: 'Kada menjati ulje',
    body: 'Tekst.',
    lead: 'Ukratko.',
    faq: [{ q: 'Koliko košta?', a: 'Od 5000 RSD.' }],
  };

  it('reads the Russian text for ru', () => {
    expect(localizedArticle(entry('oil', '2026-01-01', { faq }), 'ru')).toEqual(
      { title: 'oil', lead: 'Лид oil', body: 'Текст oil', faq },
    );
  });

  it('reads the translation for its locale', () => {
    expect(
      localizedArticle(
        entry('oil', '2026-01-01', { faq, translations: { sr } }),
        'sr',
      ),
    ).toEqual(sr);
  });

  it.each([
    ['missing', undefined],
    ['without a title', { ...sr, title: ' ' }],
    ['without a body', { ...sr, body: '' }],
    ['without a lead', { ...sr, lead: '' }],
  ])('falls back to Russian when the translation is %s', (_, translation) => {
    const article = entry('oil', '2026-01-01', {
      translations: translation && { sr: translation },
    });

    expect(localizedArticle(article, 'sr').title).toBe('oil');
  });

  it('keeps the Russian questions when the translated ones do not match them', () => {
    const article = entry('oil', '2026-01-01', {
      faq,
      translations: { en: { ...sr, faq: undefined } },
    });

    expect(localizedArticle(article, 'en')).toEqual({ ...sr, faq });
  });

  it('reads an Article without a body as an empty text', () => {
    expect(
      localizedArticle({ ...entry('oil', '2026-01-01'), body: undefined }, 'ru')
        .body,
    ).toBe('');
  });
});
