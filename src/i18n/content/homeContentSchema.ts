import { z } from 'zod';

// Single source of truth for the home page's ru/translated shape — mirrors
// dictionaryContentSchema.ts's role. The original hand-written HomeContent
// interface used fixed-length tuples ([JourneyStep,JourneyStep,...]) for
// journey/trustCards/testimonials; `.length(n)` gives the same "exactly n
// items" guarantee on a plain z.array().
const journeyStepSchema = z
  .object({ title: z.string(), desc: z.string(), note: z.string().optional() })
  .strict();

const trustCardSchema = z
  .object({ title: z.string(), text: z.string() })
  .strict();

const testimonialSchema = z
  .object({ quote: z.string(), name: z.string(), caption: z.string() })
  .strict();

const statItemSchema = z
  .object({ value: z.string(), label: z.string() })
  .strict();

// Country count is derived live from countries.json (getActiveCountries().length)
// at the call site — a hardcoded value here would go stale the moment a
// country is added or removed, as it silently did when Portugal was added.
const countStatItemSchema = z.object({ label: z.string() }).strict();

export const homeContentSchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    journey: z.array(journeyStepSchema).length(5),
    heroEyebrow: z.string(),
    heroLine1: z.string(),
    heroLine2: z.string(),
    heroLine3: z.string(),
    stampText: z.string(),
    heroSubtext: z.string(),
    statClients: statItemSchema,
    statCountries: countStatItemSchema,
    statYears: statItemSchema,
    journeyHeading: z.string(),
    journeySubtext: z.string(),
    journeyMoreLabel: z.string(),
    countryStripLabel: z.string(),
    latestCasesHeading: z.string(),
    whyUsHeading: z.string(),
    whyUsSubtext: z.string(),
    trustCards: z.array(trustCardSchema).length(3),
    testimonialsHeading: z.string(),
    testimonials: z.array(testimonialSchema).length(3),
    ctaEyebrow: z.string(),
    ctaHeading: z
      .object({ line1: z.string(), line2: z.string(), accentWord: z.string() })
      .strict(),
    ctaSubtext: z.string(),
    ctaTelegramLabel: z.string(),
    ctaStatClients: statItemSchema,
    ctaStatCountries: countStatItemSchema,
    ctaStatYears: statItemSchema,
    ctaStatResponse: statItemSchema,
  })
  .strict();

export type HomeContent = z.infer<typeof homeContentSchema>;
