import { z } from 'zod';

const sectionHeadSchema = z
  .object({
    eyebrow: z.string(),
    heading: z.string(),
    body: z.string(),
  })
  .strict();

export const homeContentSchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    hero: z
      .object({
        eyebrow: z.string(),
        titleTop: z.string(),
        titleAccent: z.string(),
        titleBottom: z.string(),
        lead: z.string(),
        ctaPrimary: z.string(),
        ctaSecondary: z.string(),
        stats: z.array(
          z.object({ value: z.string(), label: z.string() }).strict(),
        ),
      })
      .strict(),
    marquee: z.array(z.string()),
    intro: sectionHeadSchema.extend({
      points: z.array(
        z.object({ title: z.string(), text: z.string() }).strict(),
      ),
    }),
    servicesHead: sectionHeadSchema,
    compare: sectionHeadSchema,
    process: sectionHeadSchema.extend({
      steps: z.array(
        z.object({ title: z.string(), text: z.string() }).strict(),
      ),
    }),
    materials: sectionHeadSchema.extend({
      brands: z.array(z.string()),
    }),
    prices: sectionHeadSchema.extend({
      note: z.string(),
      plans: z.array(
        z
          .object({
            name: z.string(),
            price: z.string(),
            unit: z.string(),
            features: z.array(z.string()),
          })
          .strict(),
      ),
    }),
    worksHead: sectionHeadSchema,
    faq: z.array(z.object({ q: z.string(), a: z.string() }).strict()),
    finalCta: sectionHeadSchema.extend({ cta: z.string() }),
  })
  .strict();

export type HomeContent = z.infer<typeof homeContentSchema>;
