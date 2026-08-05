import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { AUTOSERVICE_SERVICES } from './utils/labels';

const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    car: z.string(),
    year: z.coerce.number(),
    price: z.object({ value: z.string(), currency: z.string().optional() }),
    country: z.string(),
    service: z.enum(['autopodbor', 'buyout', 'inspection']),
    image: image().optional(),
    gallery: z.array(image()).default([]),
    date: z.coerce.date(),
    published: z.boolean().default(true),
  }),
});

const autoserviceCases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/autoservice-cases' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    car: z.string(),
    year: z.coerce.number(),
    price: z.object({ value: z.string(), currency: z.string().optional() }),
    servicesApplied: z.array(z.enum(AUTOSERVICE_SERVICES)),
    image: image().optional(),
    gallery: z.array(image()).default([]),
    date: z.coerce.date(),
    published: z.boolean().default(true),
  }),
});

// EN/SR translations of `cases` entries. A separate collection instead of
// extra fields on `cases` itself: title/body are the only parts that differ
// per locale (car/year/price/images are shared), and Astro's `render()`
// needs a real markdown body per locale to produce a <Content /> component.
// One optional file per (case, locale) — a case with no translation yet
// just falls back to the ru original, never a broken page.
const caseTranslations = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/case-translations' }),
  schema: z.object({
    caseSlug: z.string(),
    locale: z.enum(['en', 'sr']),
    title: z.string(),
  }),
});

export const collections = { cases, autoserviceCases, caseTranslations };
