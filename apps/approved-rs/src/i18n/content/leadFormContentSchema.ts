import { z } from 'zod';

// Single source of truth for the lead form's ru/translated shape — mirrors
// dictionaryContentSchema.ts's/faqContentSchema.ts's role.
export const leadFormContentSchema = z
  .object({
    headingLine1: z.string(),
    headingEmphasis: z.string(),
    subtext: z.string(),
    nameLabel: z.string(),
    namePlaceholder: z.string(),
    contactLabel: z.string(),
    telegramTab: z.string(),
    whatsappTab: z.string(),
    viberTab: z.string(),
    phoneTab: z.string(),
    commentLabel: z.string(),
    commentPlaceholder: z.string(),
    consentBefore: z.string(),
    consentLinkText: z.string(),
    consentError: z.string(),
    submitLabel: z.string(),
    errorNameRequired: z.string(),
    errorTelegramRequired: z.string(),
    errorTelegramFormat: z.string(),
    errorPhoneRequired: z.string(),
    errorPhoneInvalid: z.string(),
  })
  .strict();

export type LeadFormContent = z.infer<typeof leadFormContentSchema>;
