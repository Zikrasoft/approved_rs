import { z } from 'zod';

// Single source of truth for the FAQ's ru/translated shape — mirrors
// dictionaryContentSchema.ts's role (types getFaq()'s return value, and
// validates every AI translation response in scripts/translate-i18n.ts
// before it's written to src/content/i18n/faq.yaml).
const faqItemSchema = z.object({ q: z.string(), a: z.string() }).strict();

export const faqContentSchema = z
  .object({
    'vehicle-sourcing': z.array(faqItemSchema),
    'vehicle-import': z.array(faqItemSchema),
    'vehicle-buyback': z.array(faqItemSchema),
    'vehicle-inspection': z.array(faqItemSchema),
    autoServiceBelgrade: z.array(faqItemSchema),
    detailingBelgrade: z.array(faqItemSchema),
    general: z.array(faqItemSchema),
    cityExpert: faqItemSchema,
  })
  .strict();

export type FaqContent = z.infer<typeof faqContentSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;
