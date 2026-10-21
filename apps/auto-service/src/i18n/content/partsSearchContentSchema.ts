import { z } from 'zod';

export const partsSearchContentSchema = z
  .object({
    searchHeading: z.string(),
    searchLead: z.string(),
    label: z.string(),
    placeholder: z.string(),
    submitLabel: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    eyebrow: z.string(),
    heading: z.string(),
    lead: z.string(),
    found: z.string(),
    noResults: z.string(),
    unavailable: z.string(),
    filtersHeading: z.string(),
    applyFilters: z.string(),
    resetFilters: z.string(),
    superseded: z.string(),
    booleanTrue: z.string(),
    booleanFalse: z.string(),
    previous: z.string(),
    next: z.string(),
    formHeading: z.string(),
  })
  .strict();
