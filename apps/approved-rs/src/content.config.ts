import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { COUNTRY_SCOPED_SERVICE_SLUGS } from './utils/labels';

const caseTranslation = z
  .object({ title: z.string(), body: z.string() })
  .optional();

const caseTranslations = z
  .object({
    en: caseTranslation,
    sr: caseTranslation,
    es: caseTranslation,
    de: caseTranslation,
  })
  .optional();

const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().trim().min(1),
      car: z.string(),
      year: z.coerce.number(),
      price: z.object({ value: z.string(), currency: z.string().optional() }),
      country: z.string(),
      service: z.enum([...COUNTRY_SCOPED_SERVICE_SLUGS, 'vehicle-import']),
      image: image().optional(),
      gallery: z.array(image()).default([]),
      date: z.coerce.date(),
      published: z.boolean().default(true),
      translations: caseTranslations,
    }),
});

export const collections = { cases };
