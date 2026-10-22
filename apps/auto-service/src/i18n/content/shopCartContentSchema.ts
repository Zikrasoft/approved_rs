import { z } from 'zod';

export const shopCartContentSchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    heading: z.string(),
    cartLink: z.string(),
    loading: z.string(),
    emptyHeading: z.string(),
    emptyBody: z.string(),
    emptyCta: z.string(),
    unitTemplate: z.string(),
    increaseLabel: z.string(),
    decreaseLabel: z.string(),
    toInquiryLabel: z.string(),
    unavailableTag: z.string(),
    removeLabel: z.string(),
    totalLabel: z.string(),
    pickupNotice: z.string(),
    addonTemplate: z.string(),
    addonPickup: z.string(),
    checkoutHeading: z.string(),
    checkoutLead: z.string(),
    commentLabel: z.string(),
    commentPlaceholder: z.string(),
    submitLabel: z.string(),
    checkoutBlocked: z.string(),
    notices: z
      .object({
        priceChanged: z.string(),
        unavailable: z.string(),
        unreachable: z.string(),
        expired: z.string(),
        invalid: z.string(),
        cartChanged: z.string(),
        repriced: z.string(),
        offline: z.string(),
        stockLimit: z.string(),
        moved: z.string(),
        movedCta: z.string(),
      })
      .strict(),
    orderedHeading: z.string(),
    orderedBody: z.string(),
    orderNumberTemplate: z.string(),
    orderedCta: z.string(),
    fallbackHeading: z.string(),
    fallbackBody: z.string(),
    fallbackRetry: z.string(),
    fallbackCta: z.string(),
  })
  .strict();

export type ShopCartContent = z.infer<typeof shopCartContentSchema>;
