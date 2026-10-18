import { z } from 'zod';

export const shopCartContentSchema = z
  .object({
    cartMetaTitle: z.string(),
    checkoutMetaTitle: z.string(),
    cartEyebrow: z.string(),
    checkoutEyebrow: z.string(),
    emptyHeading: z.string(),
    emptyBody: z.string(),
    emptyCta: z.string(),
    totalLabel: z.string(),
    currencyLabel: z.string(),
    goToCheckoutLabel: z.string(),
    pickupNotice: z.string(),
    completeButtonLabel: z.string(),
    staleHeading: z.string(),
    staleBody: z.string(),
    repriceButtonLabel: z.string(),
    orderPlacedHeading: z.string(),
    orderPlacedBody: z.string(),
    errorLabel: z.string(),
  })
  .strict();

export type ShopCartContent = z.infer<typeof shopCartContentSchema>;
