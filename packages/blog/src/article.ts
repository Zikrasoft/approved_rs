import { z } from 'zod';
import { publishedByNewest } from '@podbor/i18n';
import { paginate, type Page } from '@podbor/site-kit/pagination';

const text = z.string().trim().min(1);

const faqSchema = z.array(z.object({ question: text, answer: text }));

const translationSchema = z.object({
  title: z.string(),
  body: z.string(),
  lead: z.string(),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .optional(),
});

export function articleSchema<Image extends z.ZodType>({
  image,
  makes,
}: {
  image: Image;
  makes: readonly string[];
}) {
  return z.object({
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

export const blogPages = <A extends ArticleEntry>(
  articles: A[],
  size: number,
): Page<A>[] =>
  paginate(
    publishedByNewest(articles).filter(({ data }) => !data.overview),
    size,
  );

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
