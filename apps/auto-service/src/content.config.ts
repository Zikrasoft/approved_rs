import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { SERVICE_SLUGS } from './utils/services';

const translationSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    car: z.string().optional(),
  })
  .optional();

const works = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/works' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().trim().min(1),
        translations: z
          .object({ sr: translationSchema, en: translationSchema })
          .optional(),
        car: z.string(),
        year: z.number().optional(),
        servicesApplied: z.array(z.enum(SERVICE_SLUGS)).default([]),
        parts: z
          .array(
            z.object({
              brand: z.string().trim().min(1),
              number: z.string().trim().min(1),
            }),
          )
          .default([]),
        priceRsd: z.number().int().positive().optional(),
        image: image().optional(),
        gallery: z.array(image()).default([]),
        date: z.coerce.date(),
        published: z.boolean().default(true),
        translatedFrom: z.string().optional(),
      })
      .refine(({ published, image }) => !published || image, {
        message: 'A published Work needs a photo',
        path: ['image'],
      }),
});

export const collections = { works };
