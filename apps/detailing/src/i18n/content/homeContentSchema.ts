import { z } from 'zod';

const sectionHeadSchema = z
  .object({
    eyebrow: z.string(),
    heading: z.string(),
    body: z.string(),
  })
  .strict();

const titleTextList = z.array(
  z.object({ title: z.string(), text: z.string() }).strict(),
);

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
    intro: sectionHeadSchema.extend({ points: titleTextList }),
    protocol: sectionHeadSchema.extend({
      sheetTitle: z.string(),
      sample: z.string(),
      unit: z.string(),
      thinLabel: z.string(),
      verdictOk: z.string(),
      verdictStop: z.string(),
      rows: z
        .array(
          z
            .object({
              panel: z.string(),
              value: z.number().positive(),
              thin: z.boolean().optional(),
            })
            .strict(),
        )
        .min(1),
    }),
    servicesHead: sectionHeadSchema,
    compare: sectionHeadSchema,
    process: sectionHeadSchema.extend({ steps: titleTextList }),
    honest: sectionHeadSchema.extend({ items: titleTextList }),
    materials: sectionHeadSchema.extend({
      brands: z.array(
        z
          .object({
            name: z.string(),
            purpose: z.string(),
          })
          .strict(),
      ),
    }),
    // TODO: 2026-09-13 — prices pulled from render ("убрать пока", not "навсегда").
    // Kept on purpose until that decision is final: home.prices here,
    // PriceCards.astro, nav.prices, services.priceFrom/specsPriceLabel.
    // Delete all four together if prices are still unrendered by 2026-12-01.
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
