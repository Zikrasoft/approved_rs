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

export const collections = { cases, autoserviceCases };
