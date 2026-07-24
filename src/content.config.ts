import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    car: z.string(),
    year: z.coerce.number(),
    price: z.object({ value: z.string(), currency: z.string().optional() }),
    country: z.string(),
    service: z.enum(['autopodbor', 'delivery', 'combined', 'buyout', 'inspection']),
    image: image().optional(),
    gallery: z.array(image()).default([]),
    date: z.coerce.date(),
    published: z.boolean().default(true),
  }),
});

export const collections = { cases };
