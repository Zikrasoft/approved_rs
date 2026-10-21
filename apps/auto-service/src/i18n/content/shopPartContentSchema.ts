import { z } from 'zod';

export const shopPartContentSchema = z
  .object({
    metaTitleSuffix: z.string(),
    metaDescription: z.string(),
    eyebrow: z.string(),
    equivalentsHeading: z.string(),
    noEquivalents: z.string(),
    replacedHeading: z.string(),
    replacedLead: z.string(),
    supersededNotice: z.string(),
    supersededTag: z.string(),
    attributesHeading: z.string(),
    attributeYes: z.string(),
    attributeNo: z.string(),
    categoryLink: z.string(),
    priceOnRequestHeading: z.string(),
    priceOnRequestBody: z.string(),
    priceOnRequestCta: z.string(),
    offersHeading: z.string(),
    columns: z
      .object({
        stock: z.string(),
        leadTime: z.string(),
      })
      .strict(),
    leadTime: z
      .object({
        inStock: z.string(),
        daysTemplate: z.string(),
      })
      .strict(),
    buyButtonLabel: z.string(),
    addedNotice: z.string(),
    addedCta: z.string(),
    inquiryNotice: z.string(),
    inquiryCta: z.string(),
  })
  .strict();

export type ShopPartContent = z.infer<typeof shopPartContentSchema>;
