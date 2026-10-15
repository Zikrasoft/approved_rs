import { z } from 'zod';

const privacySectionSchema = z
  .object({ title: z.string(), text: z.string() })
  .strict();

const partsCategorySchema = z
  .object({
    name: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    lead: z.string(),
    itemsHeading: z.string(),
    items: z.array(z.string()).min(1),
  })
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
        detailCtaVariants: z
          .array(z.object({ heading: z.string(), body: z.string() }))
          .min(1),
        usefulInfoLabel: z.string(),
        doorHeading: z.string(),
        doorText: z.string(),
        doorButtonLabel: z.string(),
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
    partsInquiry: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        eyebrow: z.string(),
        heading: z.string(),
        lead: z.string(),
        sourcingNote: z.string(),
        formHeading: z.string(),
        vinLabel: z.string(),
        vinPlaceholder: z.string(),
        commentLabel: z.string(),
        commentPlaceholder: z.string(),
        commentNote: z.string(),
        stepsHeading: z.string(),
        steps: z
          .array(z.object({ heading: z.string(), body: z.string() }))
          .min(1),
        categoriesHeading: z.string(),
        categoriesLead: z.string(),
        categoryCta: z.string(),
        categories: z
          .object({
            'maintenance-consumables': partsCategorySchema,
            brakes: partsCategorySchema,
            suspension: partsCategorySchema,
            'engine-parts': partsCategorySchema,
            electrics: partsCategorySchema,
            transmission: partsCategorySchema,
            'body-parts': partsCategorySchema,
            'tires-wheels': partsCategorySchema,
          })
          .strict(),
      })
      .strict(),
    bmw: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        eyebrow: z.string(),
        heading: z.string(),
        lead: z.string(),
        trustHeading: z.string(),
        trust: z.array(z.string()),
        worksHeading: z.string(),
        ctaEyebrow: z.string(),
        ctaHeading: z.string(),
        ctaBody: z.string(),
        ctaCommentPlaceholder: z.string(),
      })
      .strict(),
  })
  .strict();

export type PagesContent = z.infer<typeof pagesContentSchema>;
