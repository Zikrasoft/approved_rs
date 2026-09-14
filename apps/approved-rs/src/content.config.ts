import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { COUNTRY_SCOPED_SERVICE_SLUGS } from './utils/labels';

// EN/SR/ES/DE translation of this case's title + body, filled in right on
// the same Keystatic entry (not a separate collection) — everything else
// (photo, price, year, country) is shared across locales and stays
// RU-only. Missing/empty → the page falls back to the ru original instead
// of breaking.
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
      title: z.string(),
      car: z.string(),
      year: z.coerce.number(),
      price: z.object({ value: z.string(), currency: z.string().optional() }),
      country: z.string(),
      // Keep in sync with the `service` select options in keystatic.config.ts —
      // Keystatic can't import this (Astro-coupled), so it's hand-duplicated there.
      service: z.enum([...COUNTRY_SCOPED_SERVICE_SLUGS, 'vehicle-import']),
      image: image().optional(),
      gallery: z.array(image()).default([]),
      date: z.coerce.date(),
      published: z.boolean().default(true),
      translations: caseTranslations,
    }),
});

export const collections = { cases };
