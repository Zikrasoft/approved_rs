import servicesYaml from '@/content/i18n/services.yaml?raw';
import type { Locale } from '@/i18n/config';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { withPlaceholder } from '@/i18n/withPlaceholder';
import { type ServiceSlug } from '@/utils/labels';
import {
  servicesContentSchema,
  type ServicesContentData,
} from './servicesContentSchema';

interface StepItem {
  n: string;
  text: string;
}

export interface CountryNote {
  lead: string;
  points: string[];
}

export interface IncludedItem {
  title: string;
  text: string;
}

export interface ServiceClosing {
  eyebrow: string;
  line1: string;
  line2: string;
  accentWord: string;
  text: string;
}

interface HubSections {
  heroPhotoAlt: string;
  processHeading: string;
  processLead: string;
  processSteps: StepItem[];
  includedHeading: string;
  includedLead: string;
  included: IncludedItem[];
}

interface ServiceHub extends HubSections {
  metaTitle: string;
  metaDescription: string;
  title: string;
  titleHighlight: string;
  description: string;
  breadcrumbLabel: string;
  casesHeading: string;
  chooseCountryLabel: string;
  ctaLabel: string;
}

interface EuCountrySpokeContent {
  metaTitle: string;
  metaDescription: string;
  title: string;
  titleHighlight: string;
  description: string;
  ctaLabel: string;
  breadcrumbLabel: string;
  casesHeading: string;
  steps: StepItem[];
  destinationsNote: string;
  chinaCrossLabel: string;
  notesHeading: string;
  notesPointsLabel: string;
  notes: CountryNote;
}

// Same public shape the original hand-written ServicesContent interface
// had — every `xFor(...)` function is restored by toServicesContent() below
// from the plain-string form servicesContentSchema.ts stores (see that
// file's comment for why). The one call site per field elsewhere in the
// codebase never sees the difference. whatWeDo/serviceBadges already carry
// their key/slug from the YAML, so those two need no reshaping at all.
export interface ServicesContent {
  'vehicle-sourcing': {
    hub: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      breadcrumbLabel: string;
      casesHeading: string;
      chooseCountryLabel: string;
      ctaLabel: string;
      compareHeading: string;
      compareLead: string;
      compareHint: string;
      compareLinkFor: (location: string) => string;
    } & HubSections;
    title: string;
    descriptionFor: (location: string) => string;
    ctaLabel: string;
    casesHeadingFor: (location: string) => string;
    breadcrumbLabelFor: (location: string) => string;
    stepsFor: (location: string) => StepItem[];
    deliveryLineFor: (destinations: string) => string;
    deliveryDestinations: string[];
    citiesHeadingFor: (countryLocation: string) => string;
    citiesLead: string;
    alsoInLabel: string;
    crossSellLabel: string;
    countryNotesHeadingFor: (location: string) => string;
    countryNotesPointsLabel: string;
    countryNoteFor: (countryCode: string) => CountryNote | undefined;
    closing: ServiceClosing;
  };
  'vehicle-buyback': {
    hub: ServiceHub;
    title: string;
    ctaLabel: string;
    casesHeading: string;
    breadcrumbLabel: string;
    descriptionSerbia: string;
    descriptionOtherFor: (name: string) => string;
    serbiaLinkLabel: string;
    step1: string;
    step2: string;
    step3Serbia: string;
    step3Other: string;
    step4: string;
    closing: ServiceClosing;
  };
  'vehicle-import': {
    hub: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      breadcrumbLabel: string;
      casesHeading: string;
      euCardTitle: string;
      euCardText: string;
      chinaCardTitle: string;
      chinaCardText: string;
      exploreLabel: string;
      ctaLabel: string;
    } & HubSections;
    de: EuCountrySpokeContent;
    es: EuCountrySpokeContent;
    ch: EuCountrySpokeContent;
    eu: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      ctaLabel: string;
      breadcrumbLabel: string;
      casesHeading: string;
      steps: StepItem[];
      sourceCountriesLabel: string;
      sourceMoreLabel: string;
      destinationsNote: string;
      notesHeading: string;
      notesPointsLabel: string;
      notes: CountryNote;
    };
    china: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      ctaLabel: string;
      breadcrumbLabel: string;
      casesHeading: string;
      steps: StepItem[];
      deCrossLabel: string;
      destinationsNote: string;
      notesHeading: string;
      notesPointsLabel: string;
      notes: CountryNote;
    };
    closing: ServiceClosing;
  };
  'vehicle-inspection': {
    title: string;
    description: string;
    ctaLabel: string;
    casesHeading: string;
    breadcrumbLabel: string;
    steps: StepItem[];
    extraLine: string;
    hub: ServiceHub & {
      mapHeading: string;
      mapLead: string;
      compareHeading: string;
      compareLead: string;
      compareHint: string;
      compareLinkFor: (location: string) => string;
    };
    countryNotesHeadingFor: (location: string) => string;
    countryNotesPointsLabel: string;
    countryNoteFor: (countryCode: string) => CountryNote | undefined;
    closing: ServiceClosing;
  };
  cityVehicleSourcing: {
    title: string;
    descriptionFor: (cityLocation: string, countryName: string) => string;
    casesHeadingFor: (countryGenitiveOrName: string) => string;
    whyCityHeadingFor: (cityName: string) => string;
    reason1: string;
    reason2: string;
    reason3For: (cityLocation: string) => string;
    reason4Dekra: string;
    reason4Generic: string;
    otherCitiesLabelFor: (countryLocation: string) => string;
    cityNotesHeadingFor: (cityLocation: string) => string;
    cityNotesPointsLabel: string;
    cityNoteFor: (citySlug: string) => CountryNote | undefined;
  };
  caseChrome: {
    autoLabel: string;
    yearLabel: string;
    priceLabel: string;
    realCaseFallback: string;
    metaOriginFor: (country: string) => string;
    metaTitleFor: (parts: {
      car: string;
      year: string;
      service: string;
      location: string;
      price: string;
    }) => string;
    ctaEyebrow: string;
    ctaHeading: string;
    ctaButtonLabel: string;
    whatsappButtonLabel: string;
    viberButtonLabel: string;
    callbackButtonLabel: string;
    callbackShortLabel: string;
    callButtonLabel: string;
    usefulInfoLabel: string;
    channelBannerTitle: string;
    channelBannerText: string;
    channelBannerCta: string;
    serviceBadges: Record<ServiceSlug, string>;
  };
}

function toServicesContent(data: ServicesContentData): ServicesContent {
  const vs = data['vehicle-sourcing'];
  const vb = data['vehicle-buyback'];
  const vi = data['vehicle-inspection'];
  const cvs = data.cityVehicleSourcing;

  return {
    'vehicle-sourcing': {
      hub: {
        ...vs.hub,
        compareLinkFor: (location) =>
          withPlaceholder(vs.hub.compareLinkFor, 'location', location),
      },
      title: vs.title,
      descriptionFor: (location) =>
        withPlaceholder(vs.descriptionFor, 'location', location),
      ctaLabel: vs.ctaLabel,
      casesHeadingFor: (location) =>
        withPlaceholder(vs.casesHeadingFor, 'location', location),
      breadcrumbLabelFor: (location) =>
        withPlaceholder(vs.breadcrumbLabelFor, 'location', location),
      stepsFor: (location) =>
        vs.stepsFor.map((step) => ({
          n: step.n,
          text: withPlaceholder(step.text, 'location', location),
        })),
      deliveryLineFor: (destinations) =>
        withPlaceholder(vs.deliveryLineFor, 'destinations', destinations),
      deliveryDestinations: vs.deliveryDestinations,
      citiesHeadingFor: (countryLocation) =>
        withPlaceholder(
          vs.citiesHeadingFor,
          'countryLocation',
          countryLocation,
        ),
      citiesLead: vs.citiesLead,
      alsoInLabel: vs.alsoInLabel,
      crossSellLabel: vs.crossSellLabel,
      countryNotesHeadingFor: (location) =>
        withPlaceholder(vs.countryNotesHeadingFor, 'location', location),
      countryNotesPointsLabel: vs.countryNotesPointsLabel,
      countryNoteFor: (countryCode) => vs.countryNotes[countryCode],
      closing: vs.closing,
    },
    'vehicle-buyback': {
      hub: vb.hub,
      title: vb.title,
      ctaLabel: vb.ctaLabel,
      casesHeading: vb.casesHeading,
      breadcrumbLabel: vb.breadcrumbLabel,
      descriptionSerbia: vb.descriptionSerbia,
      descriptionOtherFor: (name) =>
        withPlaceholder(vb.descriptionOtherFor, 'name', name),
      serbiaLinkLabel: vb.serbiaLinkLabel,
      step1: vb.step1,
      step2: vb.step2,
      step3Serbia: vb.step3Serbia,
      step3Other: vb.step3Other,
      step4: vb.step4,
      closing: vb.closing,
    },
    'vehicle-import': data['vehicle-import'],
    'vehicle-inspection': {
      ...vi,
      hub: {
        ...vi.hub,
        compareLinkFor: (location) =>
          withPlaceholder(vi.hub.compareLinkFor, 'location', location),
      },
      countryNotesHeadingFor: (location) =>
        withPlaceholder(vi.countryNotesHeadingFor, 'location', location),
      countryNoteFor: (countryCode) => vi.countryNotes[countryCode],
    },
    cityVehicleSourcing: {
      title: cvs.title,
      descriptionFor: (cityLocation, countryName) =>
        withPlaceholder(
          withPlaceholder(cvs.descriptionFor, 'cityLocation', cityLocation),
          'countryName',
          countryName,
        ),
      casesHeadingFor: (countryGenitiveOrName) =>
        withPlaceholder(
          cvs.casesHeadingFor,
          'countryGenitiveOrName',
          countryGenitiveOrName,
        ),
      whyCityHeadingFor: (cityName) =>
        withPlaceholder(cvs.whyCityHeadingFor, 'cityName', cityName),
      reason1: cvs.reason1,
      reason2: cvs.reason2,
      reason3For: (cityLocation) =>
        withPlaceholder(cvs.reason3For, 'cityLocation', cityLocation),
      reason4Dekra: cvs.reason4Dekra,
      reason4Generic: cvs.reason4Generic,
      otherCitiesLabelFor: (countryLocation) =>
        withPlaceholder(
          cvs.otherCitiesLabelFor,
          'countryLocation',
          countryLocation,
        ),
      cityNotesHeadingFor: (cityLocation) =>
        withPlaceholder(cvs.cityNotesHeadingFor, 'cityLocation', cityLocation),
      cityNotesPointsLabel: cvs.cityNotesPointsLabel,
      cityNoteFor: (citySlug) => cvs.cityNotes[citySlug],
    },
    caseChrome: {
      ...data.caseChrome,
      metaOriginFor: (country) =>
        withPlaceholder(data.caseChrome.metaOriginFor, 'country', country),
      metaTitleFor: (parts) =>
        Object.entries(parts).reduce(
          (acc, [key, value]) => withPlaceholder(acc, key, value),
          data.caseChrome.metaTitleFor,
        ),
      serviceBadges: Object.fromEntries(
        data.caseChrome.serviceBadges.map(({ slug, label }) => [slug, label]),
      ) as Record<ServiceSlug, string>,
    },
  };
}

// Admin hand-edits ru fields directly in services.yaml; en/sr/es/de filled
// in by scripts/translate-i18n.ts (.github/workflows/translate.yml) — same
// pattern as src/i18n/getI18n.ts/src/i18n/content/faq.ts.
const getServices = loadI18nSection(servicesContentSchema, servicesYaml);

export function getServicesContent(locale: Locale): ServicesContent {
  return toServicesContent(getServices(locale));
}
