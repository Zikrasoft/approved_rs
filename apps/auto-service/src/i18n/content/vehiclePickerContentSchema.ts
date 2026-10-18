import { z } from 'zod';

export const vehiclePickerContentSchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    eyebrow: z.string(),
    heading: z.string(),
    lead: z.string(),
    makeLabel: z.string(),
    modelLabel: z.string(),
    engineLabel: z.string(),
    placeholderOption: z.string(),
    submitLabel: z.string(),
    resultsHeading: z.string(),
    emptyResults: z.string(),
    viewPartCta: z.string(),
    ambiguous: z
      .object({
        heading: z.string(),
        body: z.string(),
        steeringLabel: z.string(),
        gearboxLabel: z.string(),
        steeringLeft: z.string(),
        steeringRight: z.string(),
        steeringUnknown: z.string(),
        gearboxManual: z.string(),
        gearboxAutomatic: z.string(),
        gearboxUnknown: z.string(),
      })
      .strict(),
    vehicleNotFound: z.string(),
  })
  .strict();

export type VehiclePickerContent = z.infer<typeof vehiclePickerContentSchema>;
