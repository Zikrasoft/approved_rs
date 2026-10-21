import { z } from 'zod';

export const shopPartContentSchema = z
  .object({
    metaTitleSuffix: z.string(),
    metaDescription: z.string(),
    eyebrow: z.string(),
    variantsHeading: z.string(),
    equivalentsHeading: z.string(),
    noEquivalents: z.string(),
    priceOnRequestHeading: z.string(),
    priceOnRequestBody: z.string(),
    priceOnRequestCta: z.string(),
    currencyLabel: z.string(),
    columns: z
      .object({
        brand: z.string(),
        number: z.string(),
        supplier: z.string(),
        supplierArticle: z.string(),
        price: z.string(),
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
    notFoundHeading: z.string(),
    notFoundBody: z.string(),
    notFoundCta: z.string(),
    buyButtonLabel: z.string(),
    buyErrorLabel: z.string(),
  })
  .strict();

export type ShopPartContent = z.infer<typeof shopPartContentSchema>;
