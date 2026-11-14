import { z } from 'zod';
import { publishedByNewest } from '@podbor/i18n';
import { paginate, type Page } from '@podbor/site-kit/pagination';

const text = z.string().trim().min(1);

const faqSchema = z.array(z.object({ q: text, a: text }));

const translationSchema = z.object({
  title: z.string(),
  body: z.string(),
  lead: z.string(),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
});

export function articleSchema<Image extends z.ZodType>({
  image,
  makes,
}: {
  image: Image;
  makes: readonly string[];
}) {
  return z
    .object({
      title: text,
      lead: text,
      date: z.coerce.date(),
      image,
      make: z.enum(makes).optional(),
      overview: z.boolean().default(false),
      faq: faqSchema.default([]),
      published: z.boolean().default(true),
      translations: z.record(z.string(), translationSchema).optional(),
      translatedFrom: z.string().optional(),
    })
    .refine(({ overview, make }) => !overview || make, {
      path: ['make'],
      message: 'An overview Article needs a make',
    });
}

type FrequentQuestion = z.infer<typeof faqSchema>[number];

type ArticleTranslation = z.infer<typeof translationSchema>;

export interface ArticleEntry {
  id: string;
  body?: string;
  data: {
    title: string;
    lead: string;
    date: Date;
    make?: string;
    overview: boolean;
    faq: FrequentQuestion[];
    published: boolean;
    translations?: Partial<Record<string, ArticleTranslation>>;
  };
}

export interface LocalizedArticle {
  title: string;
  lead: string;
  body: string;
  faq: FrequentQuestion[];
}

export const blogArticles = <A extends ArticleEntry>(articles: A[]): A[] =>
  publishedByNewest(articles).filter(({ data }) => !data.overview);

export const blogListed = (articles: ArticleEntry[]): boolean =>
  blogArticles(articles).length > 0;

export function makeArticles<A extends ArticleEntry>(
  articles: A[],
): { overview: A | undefined; ignoredOverviews: A[]; articles: A[] } {
  const published = publishedByNewest(articles);
  const [overview, ...ignoredOverviews] = published.filter(
    ({ data }) => data.overview,
  );
  return {
    overview,
    ignoredOverviews,
    articles: published.filter(({ data }) => !data.overview),
  };
}

export const blogPages = <A extends ArticleEntry>(
  articles: A[],
  size: number,
): Page<A>[] => paginate(blogArticles(articles), size);

export function localizedArticle(
  { body = '', data }: ArticleEntry,
  locale: string,
): LocalizedArticle {
  const { title, lead, faq } = data;
  const translated = data.translations?.[locale];
  if (
    !translated?.title.trim() ||
    !translated.body.trim() ||
    !translated.lead.trim()
  )
    return { title, lead, body, faq };
  return {
    title: translated.title,
    lead: translated.lead,
    body: translated.body,
    faq: translated.faq?.length === faq.length ? translated.faq : faq,
  };
}
