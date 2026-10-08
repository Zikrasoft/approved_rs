import { z } from 'zod';

const faqItemSchema = z.object({ q: z.string(), a: z.string() }).strict();

export const faqContentSchema = z
  .object({
    'vehicle-sourcing': z.array(faqItemSchema),
    'vehicle-import': z.array(faqItemSchema),
    'vehicle-buyback': z.array(faqItemSchema),
    'vehicle-inspection': z.array(faqItemSchema),
    general: z.array(faqItemSchema),
    cityExpert: faqItemSchema,
  })
  .strict();

export type FaqContent = z.infer<typeof faqContentSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;
