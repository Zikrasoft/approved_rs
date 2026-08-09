import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { AUTOSERVICE_SERVICES } from './utils/labels';

// EN/SR translation of this case's title + body, filled in right on the
// same Keystatic entry (not a separate collection) — everything else
// (photo, price, year, country) is shared across locales and stays
// RU-only. Missing/empty → the page falls back to the ru original instead
// of breaking.
const caseTranslation = z.object({ title: z.string(), body: z.string() }).optional();

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
    translations: z.object({ en: caseTranslation, sr: caseTranslation }).optional(),
  }),
});

const autoserviceCases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/autoservice-cases' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    car: z.string(),
    year: z.coerce.number(),
    servicesApplied: z.array(z.enum(AUTOSERVICE_SERVICES)),
    image: image().optional(),
    gallery: z.array(image()).default([]),
    date: z.coerce.date(),
    published: z.boolean().default(true),
    translations: z.object({ en: caseTranslation, sr: caseTranslation }).optional(),
  }),
});

export const collections = { cases, autoserviceCases };
