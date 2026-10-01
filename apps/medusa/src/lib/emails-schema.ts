import { z } from 'zod';

export const emailsContentSchema = z
  .object({
    orderPlaced: z
      .object({
        subject: z.string(),
        heading: z.string(),
        intro: z.string(),
        itemsHeading: z.string(),
        totalLabel: z.string(),
        pickupHeading: z.string(),
        pickupNote: z.string(),
        holdNote: z.string(),
      })
      .strict(),
  })
  .strict();

export type EmailsContent = z.infer<typeof emailsContentSchema>;
