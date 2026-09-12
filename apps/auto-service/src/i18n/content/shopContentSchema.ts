import { z } from 'zod';

export const shopContentSchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    eyebrow: z.string(),
    heading: z.string(),
    lead: z.string(),
    fitmentHeading: z.string(),
    makeLabel: z.string(),
    modelLabel: z.string(),
    yearLabel: z.string(),
    anyOption: z.string(),
    resetLabel: z.string(),
    matchCount: z
      .object({
        one: z.string(),
        few: z.string().optional(),
        many: z.string().optional(),
        other: z.string(),
      })
      .strict(),
    noMatches: z.string(),
    noMatchesHint: z.string(),
    emptyCatalog: z.string(),
    capacityLabel: z.string(),
    crankingLabel: z.string(),
    polarityLabel: z.string(),
    dimensionsLabel: z.string(),
    dimensionsUnit: z.string(),
    polarityLeft: z.string(),
    polarityRight: z.string(),
    warrantyLabel: z.string(),
    warrantyUnit: z.string(),
    fitsLabel: z.string(),
    inStock: z.string(),
    onOrder: z.string(),
    addToCart: z.string(),
    inCart: z.string(),
    installNote: z.string(),
    productMetaSuffix: z.string(),
    cart: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        eyebrow: z.string(),
        heading: z.string(),
        lead: z.string(),
        empty: z.string(),
        emptyCta: z.string(),
        quantityLabel: z.string(),
        removeLabel: z.string(),
        totalLabel: z.string(),
        totalNote: z.string(),
        orderHeading: z.string(),
        orderNote: z.string(),
        badgeLabel: z.string(),
      })
      .strict(),
  })
  .strict();

export type ShopContent = z.infer<typeof shopContentSchema>;
