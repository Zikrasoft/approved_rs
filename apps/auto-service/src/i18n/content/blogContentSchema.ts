import { z } from 'zod';

export const blogContentSchema = z
  .object({
    navLabel: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    heading: z.string(),
    lead: z.string(),
    pageName: z.string(),
    pagination: z.string(),
    empty: z.string(),
    makeLink: z.string(),
    faqHeading: z.string(),
    ctaHeading: z.string(),
    ctaBody: z.string(),
  })
  .strict();
