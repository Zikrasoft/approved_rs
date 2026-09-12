import { z } from 'zod';

const sectionHeadSchema = z
  .object({ eyebrow: z.string(), heading: z.string(), body: z.string() })
  .strict();

export const homeContentSchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    hero: z
      .object({
        eyebrow: z.string(),
        heading: z.string(),
        lead: z.string(),
        ctaPrimary: z.string(),
        ctaSecondary: z.string(),
        badges: z.array(z.string()),
      })
      .strict(),
    trust: z.array(z.object({ value: z.string(), label: z.string() }).strict()),
    servicesHead: sectionHeadSchema,
    why: sectionHeadSchema.extend({
      points: z.array(
        z.object({ title: z.string(), text: z.string() }).strict(),
      ),
    }),
    process: sectionHeadSchema.extend({
      steps: z.array(
        z.object({ title: z.string(), text: z.string() }).strict(),
      ),
    }),
    shopTeaser: sectionHeadSchema.extend({ cta: z.string() }),
    accident: sectionHeadSchema.extend({
      points: z.array(z.string()),
      cta: z.string(),
    }),
    faq: z.array(z.object({ q: z.string(), a: z.string() }).strict()),
    finalCta: sectionHeadSchema.extend({ cta: z.string() }),
  })
  .strict();

export type HomeContent = z.infer<typeof homeContentSchema>;
