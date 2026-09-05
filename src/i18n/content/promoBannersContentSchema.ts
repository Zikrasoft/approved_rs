import { z } from 'zod';

// The original hand-written file had 3 separate top-level
// Record<Locale, string[]> consts (sourcingBanners/autoserviceBanners/
// detailingBanners) — folded into one object here so this fits the same
// "ru fields + translations.<locale>" shape every other i18n section uses.
export const promoBannersContentSchema = z
  .object({
    sourcing: z.array(z.string()),
    autoservice: z.array(z.string()),
    detailing: z.array(z.string()),
  })
  .strict();

export type PromoBannersContent = z.infer<typeof promoBannersContentSchema>;
