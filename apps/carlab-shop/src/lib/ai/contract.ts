import { z } from 'zod';

export const SHOP_AI_REGISTRATION = 'shopAi';

export const quoteReadingSchema = z.object({
  vin: z.string().trim().min(1).nullable(),
  vehicle: z.string().trim().min(1).nullable(),
  lines: z.array(
    z.object({
      name: z.string().trim().min(1),
      number: z.string().trim().min(1),
      quantity: z.number().int().positive(),
      brand: z.string().trim().min(1).nullable(),
      brand_confidence: z.number().min(0).max(1),
      category_id: z.string().nullable(),
    }),
  ),
});

export type QuoteReading = z.infer<typeof quoteReadingSchema>;

export type CategoryChoice = { id: string; name: string };

export type ShopAi = {
  readQuote: (
    pdf: Buffer,
    categories: CategoryChoice[],
  ) => Promise<QuoteReading>;
};
