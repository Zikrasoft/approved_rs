import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const translationSchema = z
  .object({ title: z.string(), body: z.string() })
  .optional();

const products = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/products' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      translations: z
        .object({ sr: translationSchema, en: translationSchema })
        .optional(),
      brand: z.string(),
      price: z.number().positive(),
      capacityAh: z.number().positive(),
      crankingA: z.number().positive(),
      polarity: z.enum(['left', 'right']),
      lengthMm: z.number().positive(),
      widthMm: z.number().positive(),
      heightMm: z.number().positive(),
      warrantyMonths: z.number().positive(),
      inStock: z.boolean().default(true),
      image: image(),
      fitment: z
        .array(
          z
            .object({
              make: z.string(),
              model: z.string(),
              yearFrom: z.number().int().min(1950).max(2100),
              yearTo: z.number().int().min(1950).max(2100),
            })
            .strict()
            .refine((entry) => entry.yearTo >= entry.yearFrom, {
              message: 'yearTo must not be earlier than yearFrom',
            }),
        )
        .default([]),
      published: z.boolean().default(true),
      translatedFrom: z.string().optional(),
    }),
});

const works = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/works' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      translations: z
        .object({ sr: translationSchema, en: translationSchema })
        .optional(),
      car: z.string(),
      year: z.number().optional(),
      servicesApplied: z.array(z.string()).default([]),
      image: image(),
      gallery: z.array(image()).default([]),
      date: z.coerce.date(),
      published: z.boolean().default(true),
      translatedFrom: z.string().optional(),
    }),
});

export const collections = { products, works };
