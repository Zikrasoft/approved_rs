import { z } from 'zod';

export const leadFormContentSchema = z
  .object({
    headingLine1: z.string(),
    headingEmphasis: z.string(),
    subtext: z.string(),
    nameLabel: z.string(),
    namePlaceholder: z.string(),
    contactLabel: z.string(),
    telegramTab: z.string(),
    telegramPlaceholder: z.string(),
    whatsappTab: z.string(),
    viberTab: z.string(),
    phoneTab: z.string(),
    commentLabel: z.string(),
    commentPlaceholder: z.string(),
    consentBefore: z.string(),
    consentLinkText: z.string(),
    // TODO: no form shows consentError since the passive privacy line; drop it from the ru source, this schema and its translations together.
    consentError: z.string(),
    submitLabel: z.string(),
    errorTelegramFormat: z.string(),
    errorTelegramHandle: z.string(),
    errorPhoneInvalid: z.string(),
    errorSubmit: z.string(),
  })
  .strict();

export type LeadFormContent = z.infer<typeof leadFormContentSchema>;
