import { z } from 'zod';

export const promoBannersContentSchema = z
  .object({
    works: z.array(z.string()),
  })
  .strict();

export type PromoBannersContent = z.infer<typeof promoBannersContentSchema>;
