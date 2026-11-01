import { z } from 'zod';

const sectionHeadSchema = z
  .object({ eyebrow: z.string(), heading: z.string(), body: z.string() })
  .strict();

export const homeContentSchema = z
  .object({
    meta: z.object({ title: z.string(), description: z.string() }).strict(),
    hero: z
      .object({
        heading: z.string(),
        ctaPrimary: z.string(),
        ctaSecondary: z.string(),
        partsHeading: z.string(),
        partsSubmit: z.string(),
        partsHint: z.string(),
        partsInquiry: z.string(),
        badges: z.array(z.string()),
      })
      .strict(),
    servicesHead: sectionHeadSchema,
    problemPrompt: z
      .object({ heading: z.string(), body: z.string(), cta: z.string() })
      .strict(),
    worksHeading: z.string(),
    process: sectionHeadSchema.extend({
      steps: z.array(
        z.object({ title: z.string(), text: z.string() }).strict(),
      ),
      promises: z.array(z.string()),
    }),
    accident: sectionHeadSchema.extend({
      points: z.array(z.string()),
      cta: z.string(),
      more: z.string(),
    }),
    faqEyebrow: z.string(),
    faq: z.array(z.object({ q: z.string(), a: z.string() }).strict()),
    finalCta: sectionHeadSchema.extend({ cta: z.string() }),
  })
  .strict();

export type HomeContent = z.infer<typeof homeContentSchema>;
