import { z } from 'zod';

const pageMetaSchema = z
  .object({ metaTitle: z.string(), metaDescription: z.string() })
  .strict();

const contactsSchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    heroTitle: z.string(),
    heroSubtitle: z.string(),
    info: z.array(z.object({ label: z.string(), value: z.string() }).strict()),
    workEyebrow: z.string(),
    steps: z.array(z.object({ n: z.string(), text: z.string() }).strict()),
  })
  .strict();

// `metaDescription` holds the literal token "{siteName}" — a real string
// (so it flows through the normal translate pipeline like everything
// else), not a function like the original hand-written PagesContent
// interface had. pages.ts wraps it back into a `(siteName) => string`
// function at read time (see toPagesContent there) so the one call site
// (src/pages/[locale]/privacy.astro) doesn't need to change.
const privacySchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    heading: z.string(),
    lastUpdated: z.string(),
    sections: z.array(
      z.object({ title: z.string(), text: z.string() }).strict(),
    ),
    contactTitle: z.string(),
    contactBefore: z.string(),
    contactLinkText: z.string(),
  })
  .strict();

const thanksSchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    eyebrow: z.string(),
    heading: z.string(),
    body: z.string(),
    ctaLabel: z.string(),
    waitLabel: z.string(),
    waitCasesLink: z.string(),
    waitSourcingLink: z.string(),
  })
  .strict();

export const pagesContentSchema = z
  .object({
    contacts: contactsSchema,
    privacy: privacySchema,
    thanks: thanksSchema,
    casesVehicleSourcing: pageMetaSchema,
    casesVehicleBuyback: pageMetaSchema,
    casesVehicleInspection: pageMetaSchema,
    casesVehicleImport: pageMetaSchema,
    casesAutoService: pageMetaSchema,
    casesDetailing: pageMetaSchema,
    casesShared: z
      .object({ heroSubtitle: z.string(), emptyState: z.string() })
      .strict(),
  })
  .strict();

export type PagesContentData = z.infer<typeof pagesContentSchema>;
