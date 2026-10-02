import { z } from 'zod';

export const captureBotContentSchema = z
  .object({
    greeting: z.string(),
    lookingFor: z.string(),
    budget: z.string(),
    thanks: z.string(),
  })
  .strict();

export type CaptureBotContent = z.infer<typeof captureBotContentSchema>;
