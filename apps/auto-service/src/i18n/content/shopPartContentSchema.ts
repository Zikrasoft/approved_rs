import { z } from 'zod';

export const shopPartContentSchema = z
  .object({
    metaTitleSuffix: z.string(),
    metaDescription: z.string(),
    eyebrow: z.string(),
    equivalentsHeading: z.string(),
    noEquivalents: z.string(),
    numberSupersededNotice: z.string(),
    partReplacedNotice: z.string(),
    previousNumber: z.string(),
    previousNumberCurrent: z.string(),
    earlierNumbers: z.string(),
    previousNumbersHeading: z.string(),
    currentNumberLabel: z.string(),
    currentNumbersLabel: z.string(),
    successorOffersHeading: z.string(),
    attributesHeading: z.string(),
    attributeYes: z.string(),
    attributeNo: z.string(),
    categoryLink: z.string(),
    priceOnRequestHeading: z.string(),
    priceOnRequestBody: z.string(),
    priceOnRequestCta: z.string(),
    orderBody: z.string(),
    offersHeading: z.string(),
    columns: z
      .object({
        stock: z.string(),
        leadTime: z.string(),
        leadTimeShort: z.string(),
        inStockPickup: z.string(),
      })
      .strict(),
    leadTime: z
      .object({
        inStock: z.string(),
        days: z
          .object({
            one: z.string().optional(),
            two: z.string().optional(),
            few: z.string().optional(),
            many: z.string().optional(),
            other: z.string(),
          })
          .strict(),
      })
      .strict(),
    buyButtonLabel: z.string(),
    addedLabel: z.string(),
    outOfStock: z.string(),
    askSupplyCta: z.string(),
    askedNotice: z.string(),
    stockLimitNotice: z.string(),
    fromPrice: z.string(),
    priceOnRequestTag: z.string(),
    addedNotice: z.string(),
    addedCta: z.string(),
    inquiryNotice: z.string(),
    inquiryCta: z.string(),
    photoLabel: z.string(),
    categoryIllustration: z.string(),
    illustrationLabel: z.string(),
    installHeading: z.string(),
    installBody: z.string(),
    installCta: z.string(),
    crossReferencesHeading: z.string(),
    worksHeading: z.string(),
    applicabilityHeading: z.string(),
    supplierDataNote: z.string(),
    requirementCarsLabel: z.string(),
    kitCarsLabel: z.string(),
  })
  .strict();

export type ShopPartContent = z.infer<typeof shopPartContentSchema>;
