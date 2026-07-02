import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    car: z.string(),
    year: z.number(),
    price: z.string(),
    country: z.string(),
    service: z.enum(['autopodbor', 'delivery', 'combined', 'buyout', 'inspection']),
    image: z.string().optional(),
    date: z.coerce.date(),
    published: z.boolean().default(true),
  }),
});

export const collections = { cases };
