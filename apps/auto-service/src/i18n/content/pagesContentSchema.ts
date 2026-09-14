import { z } from 'zod';

const privacySectionSchema = z
  .object({ title: z.string(), text: z.string() })
  .strict();

export const pagesContentSchema = z
  .object({
    works: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        eyebrow: z.string(),
        heading: z.string(),
        lead: z.string(),
        detailMetaSuffix: z.string(),
        detailCtaHeading: z.string(),
        detailCtaBody: z.string(),
      })
      .strict(),
    contact: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        eyebrow: z.string(),
        heading: z.string(),
        lead: z.string(),
        addressLabel: z.string(),
        hoursLabel: z.string(),
        mapHeading: z.string(),
        mapNote: z.string(),
        arrivalHeading: z.string(),
        arrival: z.array(z.string()),
      })
      .strict(),
    thanks: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        eyebrow: z.string(),
        heading: z.string(),
        body: z.string(),
        note: z.string(),
        cta: z.string(),
      })
      .strict(),
    privacy: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        heading: z.string(),
        lastUpdated: z.string(),
        sections: z.array(privacySectionSchema),
        // Rendered only when SHOP_ENABLED: a separate list, so nothing depends
        // on a shared array index or on a flag the translate job could drop.
        shopSections: z.array(privacySectionSchema),
        contactTitle: z.string(),
        contactBefore: z.string(),
      })
      .strict(),
    notFound: z
      .object({
        metaTitle: z.string(),
        heading: z.string(),
        body: z.string(),
        cta: z.string(),
      })
      .strict(),
  })
  .strict();

export type PagesContent = z.infer<typeof pagesContentSchema>;
