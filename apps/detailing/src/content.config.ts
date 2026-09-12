import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { SERVICE_SLUGS } from './utils/services';

const translationSchema = z
  .object({ title: z.string(), body: z.string() })
  .optional();

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
      servicesApplied: z.array(z.enum(SERVICE_SLUGS)).default([]),
      image: image(),
      beforeImage: image().optional(),
      gallery: z.array(image()).default([]),
      date: z.coerce.date(),
      published: z.boolean().default(true),
      translatedFrom: z.string().optional(),
    }),
});

export const collections = { works };
