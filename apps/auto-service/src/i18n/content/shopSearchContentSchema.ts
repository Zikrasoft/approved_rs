import { z } from 'zod';

export const shopSearchContentSchema = z
  .object({
    metaTitleSuffix: z.string(),
    metaDescription: z.string(),
    eyebrow: z.string(),
    heading: z.string(),
    placeholder: z.string(),
    submitLabel: z.string(),
    notFoundHeading: z.string(),
    notFoundBody: z.string(),
    notFoundCta: z.string(),
  })
  .strict();

export type ShopSearchContent = z.infer<typeof shopSearchContentSchema>;
