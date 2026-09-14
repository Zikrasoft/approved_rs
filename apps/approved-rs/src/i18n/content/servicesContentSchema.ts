import { z } from 'zod';

// Single source of truth for the services content's ru/translated shape.
// Every multi-param function the original hand-written ServicesContent
// interface had (descriptionFor(location), etc.) becomes a plain string
// containing literal {paramName} tokens here — same pattern as
// pagesContentSchema.ts/metaContentSchema.ts. services.ts wraps each back
// into its original function signature at read time.
//
// whatWeDo/serviceBadges carry their key/slug in the YAML itself (not
// zipped on by array position) so a reordered entry — a routine admin YAML
// edit, or a translated array that keeps its length but not its order —
// can't silently relabel content. z.enum rejects any key that isn't one of
// these literals, so a typo or a stale value fails loudly instead of
// mismapping.
//
// Mirrors src/utils/labels.ts's SERVICE_SLUGS, duplicated as plain
// literals rather than imported: this
// schema must stay runnable standalone via `node --experimental-strip-types
// scripts/translate-i18n.ts`, and labels.ts pulls in getI18n.ts's Vite-only
// `?raw` YAML import, which plain Node can't resolve. Keep in sync by hand.
const SERVICE_SLUG_KEYS = [
  'vehicle-sourcing',
  'vehicle-buyback',
  'vehicle-inspection',
  'vehicle-import',
] as const;

const stepItemSchema = z.object({ n: z.string(), text: z.string() }).strict();

// Keyed by country code from countries.json rather than a z.enum: a country
// that has no notes yet simply renders no section, and adding one to the data
// file must not need a schema edit too.
const countryNoteSchema = z
  .object({ lead: z.string(), points: z.array(z.string()).min(2) })
  .strict();
const countryNotesSchema = z.record(z.string(), countryNoteSchema);

const includedItemSchema = z
  .object({ title: z.string(), text: z.string() })
  .strict();
const closingSchema = z
  .object({
    eyebrow: z.string(),
    line1: z.string(),
    line2: z.string(),
    accentWord: z.string(),
    text: z.string(),
  })
  .strict();

// Only the two hubs that front a set of country markets carry these.
const compareSchema = {
  compareHeading: z.string(),
  compareLead: z.string(),
  compareHint: z.string(),
  compareLinkFor: z.string(),
};

const hubSectionsSchema = {
  heroPhotoAlt: z.string(),
  processHeading: z.string(),
  processLead: z.string(),
  processSteps: z.array(stepItemSchema).min(3),
  includedHeading: z.string(),
  includedLead: z.string(),
  included: z.array(includedItemSchema).min(3),
};

const serviceHubSchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    title: z.string(),
    titleHighlight: z.string(),
    description: z.string(),
    breadcrumbLabel: z.string(),
    casesHeading: z.string(),
    chooseCountryLabel: z.string(),
    ctaLabel: z.string(),
    ...hubSectionsSchema,
  })
  .strict();

const euCountrySpokeSchema = z
  .object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    title: z.string(),
    titleHighlight: z.string(),
    description: z.string(),
    ctaLabel: z.string(),
    breadcrumbLabel: z.string(),
    casesHeading: z.string(),
    steps: z.array(stepItemSchema).length(5),
    destinationsNote: z.string(),
    chinaCrossLabel: z.string(),
    notesHeading: z.string(),
    notesPointsLabel: z.string(),
    notes: countryNoteSchema,
  })
  .strict();

export const servicesContentSchema = z
  .object({
    'vehicle-sourcing': z
      .object({
        hub: z
          .object({
            metaTitle: z.string(),
            metaDescription: z.string(),
            title: z.string(),
            titleHighlight: z.string(),
            description: z.string(),
            breadcrumbLabel: z.string(),
            casesHeading: z.string(),
            chooseCountryLabel: z.string(),
            ctaLabel: z.string(),
            ...hubSectionsSchema,
            ...compareSchema,
          })
          .strict(),
        title: z.string(),
        descriptionFor: z.string(),
        ctaLabel: z.string(),
        casesHeadingFor: z.string(),
        breadcrumbLabelFor: z.string(),
        stepsFor: z.array(stepItemSchema).length(5),
        deliveryLineFor: z.string(),
        deliveryDestinations: z.array(z.string()),
        citiesHeadingFor: z.string(),
        citiesLead: z.string(),
        alsoInLabel: z.string(),
        crossSellLabel: z.string(),
        countryNotesHeadingFor: z.string(),
        countryNotesPointsLabel: z.string(),
        countryNotes: countryNotesSchema,
        closing: closingSchema,
      })
      .strict(),
    'vehicle-buyback': z
      .object({
        hub: serviceHubSchema,
        title: z.string(),
        ctaLabel: z.string(),
        casesHeading: z.string(),
        breadcrumbLabel: z.string(),
        descriptionSerbia: z.string(),
        descriptionOtherFor: z.string(),
        serbiaLinkLabel: z.string(),
        step1: z.string(),
        step2: z.string(),
        step3Serbia: z.string(),
        step3Other: z.string(),
        step4: z.string(),
        closing: closingSchema,
      })
      .strict(),
    'vehicle-import': z
      .object({
        hub: z
          .object({
            metaTitle: z.string(),
            metaDescription: z.string(),
            title: z.string(),
            titleHighlight: z.string(),
            description: z.string(),
            breadcrumbLabel: z.string(),
            casesHeading: z.string(),
            euCardTitle: z.string(),
            euCardText: z.string(),
            chinaCardTitle: z.string(),
            chinaCardText: z.string(),
            exploreLabel: z.string(),
            ctaLabel: z.string(),
            ...hubSectionsSchema,
          })
          .strict(),
        de: euCountrySpokeSchema,
        es: euCountrySpokeSchema,
        ch: euCountrySpokeSchema,
        eu: z
          .object({
            metaTitle: z.string(),
            metaDescription: z.string(),
            title: z.string(),
            titleHighlight: z.string(),
            description: z.string(),
            ctaLabel: z.string(),
            breadcrumbLabel: z.string(),
            casesHeading: z.string(),
            steps: z.array(stepItemSchema).length(5),
            sourceCountriesLabel: z.string(),
            sourceMoreLabel: z.string(),
            destinationsNote: z.string(),
            notesHeading: z.string(),
            notesPointsLabel: z.string(),
            notes: countryNoteSchema,
          })
          .strict(),
        china: z
          .object({
            metaTitle: z.string(),
            metaDescription: z.string(),
            title: z.string(),
            titleHighlight: z.string(),
            description: z.string(),
            ctaLabel: z.string(),
            breadcrumbLabel: z.string(),
            casesHeading: z.string(),
            steps: z.array(stepItemSchema).length(5),
            deCrossLabel: z.string(),
            destinationsNote: z.string(),
            notesHeading: z.string(),
            notesPointsLabel: z.string(),
            notes: countryNoteSchema,
          })
          .strict(),
        closing: closingSchema,
      })
      .strict(),
    'vehicle-inspection': z
      .object({
        title: z.string(),
        description: z.string(),
        ctaLabel: z.string(),
        casesHeading: z.string(),
        breadcrumbLabel: z.string(),
        steps: z.array(stepItemSchema),
        extraLine: z.string(),
        hub: serviceHubSchema
          .extend(compareSchema)
          // Only this hub renders the four-zone map, so only it needs a head
          // for it — the homepage's own wording would collide on one h2.
          .extend({ mapHeading: z.string(), mapLead: z.string() })
          .strict(),
        countryNotesHeadingFor: z.string(),
        countryNotesPointsLabel: z.string(),
        countryNotes: countryNotesSchema,
        closing: closingSchema,
      })
      .strict(),
    cityVehicleSourcing: z
      .object({
        title: z.string(),
        descriptionFor: z.string(),
        casesHeadingFor: z.string(),
        whyCityHeadingFor: z.string(),
        reason1: z.string(),
        reason2: z.string(),
        reason3For: z.string(),
        reason4Dekra: z.string(),
        reason4Generic: z.string(),
        otherCitiesLabelFor: z.string(),
        cityNotesHeadingFor: z.string(),
        cityNotesPointsLabel: z.string(),
        cityNotes: countryNotesSchema,
      })
      .strict(),
    caseChrome: z
      .object({
        autoLabel: z.string(),
        yearLabel: z.string(),
        priceLabel: z.string(),
        realCaseFallback: z.string(),
        metaTitleFor: z.string(),
        metaOriginFor: z.string(),
        ctaEyebrow: z.string(),
        ctaHeading: z.string(),
        ctaButtonLabel: z.string(),
        whatsappButtonLabel: z.string(),
        viberButtonLabel: z.string(),
        callbackButtonLabel: z.string(),
        callbackShortLabel: z.string(),
        callButtonLabel: z.string(),
        usefulInfoLabel: z.string(),
        channelBannerTitle: z.string(),
        channelBannerText: z.string(),
        channelBannerCta: z.string(),
        serviceBadges: z
          .array(
            z
              .object({ slug: z.enum(SERVICE_SLUG_KEYS), label: z.string() })
              .strict(),
          )
          .length(SERVICE_SLUG_KEYS.length),
      })
      .strict(),
  })
  .strict();

export type ServicesContentData = z.infer<typeof servicesContentSchema>;
