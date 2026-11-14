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
        detailCtaVariants: z
          .array(z.object({ heading: z.string(), body: z.string() }))
          .min(1),
        doorHeading: z.string(),
        doorText: z.string(),
        doorButtonLabel: z.string(),
        partsHeading: z.string(),
        factCar: z.string(),
        factDate: z.string(),
        filterLabel: z.string(),
        filterAll: z.string(),
        relatedHeading: z.string(),
        sourcingCta: z.object({ heading: z.string(), body: z.string() }),
      })
      .strict(),
    contact: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        heading: z.string(),
        addressLabel: z.string(),
        hoursLabel: z.string(),
        mapHeading: z.string(),
        openMap: z.string(),
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
        visitLabel: z.string(),
        body: z.string(),
        note: z.string(),
        cta: z.string(),
      })
      .strict(),
    thanksParts: z
      .object({
        body: z.string(),
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
        contactTitle: z.string(),
        contactBefore: z.string(),
      })
      .strict(),
    about: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        heading: z.string(),
        lead: z.string(),
        teamHeading: z.string(),
        team: z.array(z.string()),
        equipmentHeading: z.string(),
        equipment: z.array(z.string()),
        makesHeading: z.string(),
        makesLead: z.string(),
        loungeHeading: z.string(),
        loungeText: z.string(),
        ownerHeading: z.string(),
        ownerText: z.string(),
      })
      .strict(),
    notFound: z
      .object({
        metaTitle: z.string(),
        heading: z.string(),
        body: z.string(),
        partsBody: z.string(),
        writeUs: z.string(),
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
        formNote: z.string(),
        vinLabel: z.string(),
        vinPlaceholder: z.string(),
        // TODO: drop vinNote and commentNote once the translate job has pruned them from the translations.
        vinNote: z.string().optional(),
        commentLabel: z.string(),
        commentPlaceholder: z.string(),
        commentNote: z.string().optional(),
        moreDetails: z.string(),
        listHeading: z.string(),
        listRemoveLabel: z.string(),
        listQuantityLabel: z.string(),
        listCarRemoveLabel: z.string(),
        listMoreTemplate: z.string(),
        llmsCatalogue: z.string(),
        llmsCatalogueClosed: z.string(),
        stepsHeading: z.string(),
        steps: z
          .array(z.object({ heading: z.string(), body: z.string() }))
          .min(1),
        categoriesHeading: z.string(),
        categoriesLead: z.string(),
        categoryCta: z.string(),
        categoryOrderCta: z.string(),
        category: z
          .object({
            eyebrow: z.string(),
            metaTitleTemplate: z.string().includes('{name}'),
            partsHeading: z.string(),
            noParts: z.string(),
            fieldsHeading: z.string(),
            pageName: z.string().includes('{name}').includes('{page}'),
            pagination: z.string(),
            car: z
              .object({
                heading: z.string(),
                make: z.string(),
                makePlaceholder: z.string(),
                model: z.string(),
                modelPlaceholder: z.string(),
                submit: z.string(),
              })
              .strict(),
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
    make: z
      .object({
        metaTitleTemplate: z.string().includes('{make}'),
        metaDescriptionTemplate: z.string().includes('{make}'),
        headingTemplate: z.string().includes('{make}'),
        leadTemplate: z.string().includes('{make}'),
        servicesHeadingTemplate: z.string().includes('{make}'),
        worksHeadingTemplate: z.string().includes('{make}'),
        worksAllTemplate: z.string().includes('{make}'),
        faqHeadingTemplate: z.string().includes('{make}'),
        articlesHeadingTemplate: z.string().includes('{make}'),
        ctaHeadingTemplate: z.string().includes('{make}'),
        ctaBody: z.string(),
        ctaCommentPlaceholder: z.string(),
      })
      .strict(),
  })
  .strict();

export type PagesContent = z.infer<typeof pagesContentSchema>;
