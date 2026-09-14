import { z } from 'zod';

const serviceSchema = z
  .object({
    name: z.string(),
    short: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    heroEyebrow: z.string(),
    heroTitle: z.string(),
    heroLead: z.string(),
    priceFrom: z.string(),
    duration: z.string(),
    warranty: z.string(),
    bodyHeading: z.string(),
    body: z.string(),
    includesHeading: z.string(),
    includes: z.array(z.string()),
    forWhomHeading: z.string(),
    forWhom: z.array(z.string()),
    honestHeading: z.string(),
    honest: z.string(),
  })
  .strict();

export const servicesContentSchema = z
  .object({
    indexMetaTitle: z.string(),
    indexMetaDescription: z.string(),
    indexEyebrow: z.string(),
    indexHeading: z.string(),
    indexLead: z.string(),
    specsPriceLabel: z.string(),
    specsDurationLabel: z.string(),
    specsWarrantyLabel: z.string(),
    'paint-protection-film': serviceSchema,
    'colour-change-wrap': serviceSchema,
    'polishing-ceramic': serviceSchema,
    'steering-wheel-restoration': serviceSchema,
  })
  .strict();

export type ServicesContent = z.infer<typeof servicesContentSchema>;
