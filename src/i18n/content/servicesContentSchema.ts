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
// Mirrors src/utils/labels.ts's AUTOSERVICE_SERVICES/DETAILING_SERVICES/
// SERVICE_SLUGS, duplicated as plain literals rather than imported: this
// schema must stay runnable standalone via `node --experimental-strip-types
// scripts/translate-i18n.ts`, and labels.ts pulls in getI18n.ts's Vite-only
// `?raw` YAML import, which plain Node can't resolve. Keep in sync by hand.
const AUTOSERVICE_KEYS = [
  'diagnostics',
  'maintenance',
  'suspension',
  'engine',
  'prepurchase',
] as const;
const DETAILING_KEYS = ['wrap'] as const;
const SERVICE_SLUG_KEYS = [
  'vehicle-sourcing',
  'vehicle-buyback',
  'vehicle-inspection',
  'vehicle-import',
  'auto-service-belgrade',
  'detailing-belgrade',
] as const;

const stepItemSchema = z.object({ n: z.string(), text: z.string() }).strict();

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
  })
  .strict();

const whatWeDoItemSchema = <T extends readonly [string, ...string[]]>(
  keys: T,
) =>
  z.object({ key: z.enum(keys), label: z.string(), desc: z.string() }).strict();

// autoServiceBelgrade and detailingBelgrade are identical apart from which
// (and how many) whatWeDo keys they carry — one factory instead of two
// hand-copied 20-field object schemas.
const belgradeServiceSchema = <T extends readonly [string, ...string[]]>(
  whatWeDoKeys: T,
) =>
  z
    .object({
      metaTitle: z.string(),
      metaDescription: z.string(),
      title: z.string(),
      titleHighlight: z.string(),
      description: z.string(),
      ctaLabel: z.string(),
      breadcrumbLabel: z.string(),
      whatWeDoHeading: z.string(),
      whatWeDo: z
        .array(whatWeDoItemSchema(whatWeDoKeys))
        .length(whatWeDoKeys.length),
      commentLabel: z.string(),
      commentPlaceholder: z.string(),
      alsoSourcingLabel: z.string(),
      howToFindHeading: z.string(),
      addressLabel: z.string(),
      streetAddress: z.string(),
      cityCountryLine: z.string(),
      mapButtonLabel: z.string(),
      mapIframeTitle: z.string(),
      worksHeading: z.string(),
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
        citiesLabel: z.string(),
        alsoInLabel: z.string(),
        crossSellLabel: z.string(),
      })
      .strict(),
    'vehicle-buyback': z
      .object({
        title: z.string(),
        ctaLabel: z.string(),
        casesHeading: z.string(),
        breadcrumbLabel: z.string(),
        descriptionSerbia: z.string(),
        descriptionOtherFor: z.string(),
        step1: z.string(),
        step2: z.string(),
        step3Serbia: z.string(),
        step3Other: z.string(),
        step4: z.string(),
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
          })
          .strict(),
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
      })
      .strict(),
    autoServiceBelgrade: belgradeServiceSchema(AUTOSERVICE_KEYS),
    detailingBelgrade: belgradeServiceSchema(DETAILING_KEYS),
    caseChrome: z
      .object({
        autoLabel: z.string(),
        yearLabel: z.string(),
        priceLabel: z.string(),
        realCaseFallback: z.string(),
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
