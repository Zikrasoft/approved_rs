import { z } from 'zod';

export const captureCopySchema = z
  .object({
    greeting: z.string(),
    lookingFor: z.string(),
    budget: z.string(),
    phoneAsk: z.string(),
    phoneOffer: z.string(),
    phoneButton: z.string(),
    phoneSkip: z.string(),
    thanks: z.string(),
    received: z.string(),
  })
  .strict();

export type CaptureCopy = z.infer<typeof captureCopySchema>;
