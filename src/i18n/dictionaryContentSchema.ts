import { z } from 'zod';

// Single source of truth for the dictionary's ru/translated shape — used to
// type getI18n()'s return value AND to validate every AI translation
// response before it's written to src/content/i18n/dictionary.yaml
// (scripts/translate-i18n.ts). `.strict()` at every level rejects a
// response with a missing/extra/wrong-typed key instead of silently
// corrupting the YAML — a hand-rolled structural check here previously
// treated "an array became a string" as compatible (both "not a plain
// object"), which zod's `.string()` on each leaf catches directly.
export const dictionaryContentSchema = z
  .object({
    nav: z
      .object({
        'vehicle-sourcing': z.string(),
        'vehicle-import': z.string(),
        'auto-service-belgrade': z.string(),
        'detailing-belgrade': z.string(),
        'vehicle-buyback': z.string(),
        'vehicle-inspection': z.string(),
        cases: z.string(),
        contacts: z.string(),
        moreServices: z.string(),
      })
      .strict(),
    header: z
      .object({
        menuLabel: z.string(),
        languageLabel: z.string(),
        themeToggleLabel: z.string(),
        themeToggleMobileLabel: z.string(),
        ctaShort: z.string(),
        ctaLong: z.string(),
      })
      .strict(),
    footer: z
      .object({
        servicesHeading: z.string(),
        companyHeading: z.string(),
        privacyLabel: z.string(),
        tagline: z.string(),
        contactManagerLabel: z.string(),
        hoursLine: z.string(),
        copyrightSuffix: z.string(),
        channelLinkLabel: z.string(),
      })
      .strict(),
    common: z
      .object({
        otherServicesLabel: z.string(),
        alsoWorkingInLabel: z.string(),
        homeLabel: z.string(),
        faqHeading: z.string(),
        whereFromLabel: z.string(),
        otherCountryLabel: z.string(),
        viewAllCasesLabel: z.string(),
        closeLabel: z.string(),
        channelLabel: z.string(),
        cookie: z
          .object({
            notice: z.string(),
            more: z.string(),
            policyLink: z.string(),
            accept: z.string(),
            decline: z.string(),
          })
          .strict(),
        gallery: z
          .object({
            morePhotos: z.string(),
            prev: z.string(),
            next: z.string(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type DictionaryContent = z.infer<typeof dictionaryContentSchema>;
