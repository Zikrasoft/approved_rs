import * as z from 'zod/mini';
import {
  CHECKOUT_REFUSALS,
  offerCartSchema,
  partOfferSchema,
} from '@podbor/catalog-contract/cart-wire';

const inquirySchema = z.object({ kind: z.literal('inquiry') });

export const offersOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('offers'), offers: z.array(partOfferSchema) }),
  inquirySchema,
]);

export const cartOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cart'), cart: offerCartSchema }),
  z.object({ kind: z.literal('empty') }),
  z.object({
    kind: z.literal('refused'),
    code: z.enum(CHECKOUT_REFUSALS),
    cartId: z.nullable(z.string()),
  }),
  inquirySchema,
]);

export type OffersOutcome = z.infer<typeof offersOutcomeSchema>;
export type CartOutcome = z.infer<typeof cartOutcomeSchema>;
