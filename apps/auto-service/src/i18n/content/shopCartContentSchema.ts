import { z } from 'zod';

export const shopCartContentSchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    heading: z.string(),
    lead: z.string(),
    cartLink: z.string(),
    loading: z.string(),
    emptyHeading: z.string(),
    emptyBody: z.string(),
    emptyCta: z.string(),
    quantityTemplate: z.string(),
    unavailableTag: z.string(),
    removeLabel: z.string(),
    totalLabel: z.string(),
    pickupNotice: z.string(),
    checkoutHeading: z.string(),
    checkoutLead: z.string(),
    commentLabel: z.string(),
    commentPlaceholder: z.string(),
    submitLabel: z.string(),
    notices: z
      .object({
        priceChanged: z.string(),
        unavailable: z.string(),
        unreachable: z.string(),
      })
      .strict(),
    orderedHeading: z.string(),
    orderedBody: z.string(),
    orderedCta: z.string(),
    fallbackHeading: z.string(),
    fallbackBody: z.string(),
    fallbackCta: z.string(),
  })
  .strict();

export type ShopCartContent = z.infer<typeof shopCartContentSchema>;
