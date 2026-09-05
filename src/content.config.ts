import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import {
  AUTOSERVICE_SERVICES,
  DETAILING_SERVICES,
  COUNTRY_SCOPED_SERVICE_SLUGS,
} from './utils/labels';

// EN/SR/ES/DE translation of this case's title + body, filled in right on
// the same Keystatic entry (not a separate collection) — everything else
// (photo, price, year, country) is shared across locales and stays
// RU-only. Missing/empty → the page falls back to the ru original instead
// of breaking.
const caseTranslation = z
  .object({ title: z.string(), body: z.string() })
  .optional();

// Same optional-per-locale shape for every non-ru locale — one schema
// object reused by both collections below instead of hand-duplicating the
// key list (and forgetting to add a language to one of the two).
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

// Shared by autoserviceCases/detailingCases below — identical shape, only
// the source directory and the servicesApplied enum differ per service.
function serviceCaseCollection<T extends readonly [string, ...string[]]>(
  base: string,
  services: T,
) {
  return defineCollection({
    loader: glob({ pattern: '**/*.md', base }),
    schema: ({ image }) =>
      z.object({
        title: z.string(),
        car: z.string().optional(),
        year: z.coerce.number().optional(),
        servicesApplied: z.array(z.enum(services)),
        image: image().optional(),
        gallery: z.array(image()).default([]),
        date: z.coerce.date(),
        published: z.boolean().default(true),
        translations: caseTranslations,
      }),
  });
}

const autoserviceCases = serviceCaseCollection(
  './src/content/autoservice-cases',
  AUTOSERVICE_SERVICES,
);
const detailingCases = serviceCaseCollection(
  './src/content/detailing-cases',
  DETAILING_SERVICES,
);

export const collections = { cases, autoserviceCases, detailingCases };
