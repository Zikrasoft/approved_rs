import servicesYaml from '../../content/i18n/services.yaml?raw';
import type { Locale } from '@/i18n/config';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { withPlaceholder } from '@/i18n/withPlaceholder';
import {
  AUTOSERVICE_SERVICES,
  DETAILING_SERVICES,
  type ServiceSlug,
} from '@/utils/labels';
import {
  servicesContentSchema,
  type ServicesContentData,
} from './servicesContentSchema';

interface StepItem {
  n: string;
  text: string;
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
    };
    title: string;
    descriptionFor: (location: string) => string;
    ctaLabel: string;
    casesHeadingFor: (location: string) => string;
    breadcrumbLabelFor: (location: string) => string;
    stepsFor: (location: string) => StepItem[];
    deliveryLineFor: (destinations: string) => string;
    deliveryDestinations: string[];
    citiesLabel: string;
    alsoInLabel: string;
    crossSellLabel: string;
  };
  'vehicle-buyback': {
    title: string;
    ctaLabel: string;
    casesHeading: string;
    breadcrumbLabel: string;
    descriptionSerbia: string;
    descriptionOtherFor: (name: string) => string;
    step1: string;
    step2: string;
    step3Serbia: string;
    step3Other: string;
    step4: string;
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
    };
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
    };
  };
  'vehicle-inspection': {
    title: string;
    description: string;
    ctaLabel: string;
    casesHeading: string;
    breadcrumbLabel: string;
    steps: StepItem[];
    extraLine: string;
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
  };
  autoServiceBelgrade: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    titleHighlight: string;
    description: string;
    ctaLabel: string;
    breadcrumbLabel: string;
    whatWeDoHeading: string;
    whatWeDo: {
      key: (typeof AUTOSERVICE_SERVICES)[number];
      label: string;
      desc: string;
    }[];
    commentLabel: string;
    commentPlaceholder: string;
    alsoSourcingLabel: string;
    howToFindHeading: string;
    addressLabel: string;
    streetAddress: string;
    cityCountryLine: string;
    mapButtonLabel: string;
    mapIframeTitle: string;
    worksHeading: string;
  };
  detailingBelgrade: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    titleHighlight: string;
    description: string;
    ctaLabel: string;
    breadcrumbLabel: string;
    whatWeDoHeading: string;
    whatWeDo: {
      key: (typeof DETAILING_SERVICES)[number];
      label: string;
      desc: string;
    }[];
    commentLabel: string;
    commentPlaceholder: string;
    alsoSourcingLabel: string;
    howToFindHeading: string;
    addressLabel: string;
    streetAddress: string;
    cityCountryLine: string;
    mapButtonLabel: string;
    mapIframeTitle: string;
    worksHeading: string;
  };
  caseChrome: {
    autoLabel: string;
    yearLabel: string;
    priceLabel: string;
    realCaseFallback: string;
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
  const cvs = data.cityVehicleSourcing;

  return {
    'vehicle-sourcing': {
      hub: vs.hub,
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
      citiesLabel: vs.citiesLabel,
      alsoInLabel: vs.alsoInLabel,
      crossSellLabel: vs.crossSellLabel,
    },
    'vehicle-buyback': {
      title: vb.title,
      ctaLabel: vb.ctaLabel,
      casesHeading: vb.casesHeading,
      breadcrumbLabel: vb.breadcrumbLabel,
      descriptionSerbia: vb.descriptionSerbia,
      descriptionOtherFor: (name) =>
        withPlaceholder(vb.descriptionOtherFor, 'name', name),
      step1: vb.step1,
      step2: vb.step2,
      step3Serbia: vb.step3Serbia,
      step3Other: vb.step3Other,
      step4: vb.step4,
    },
    'vehicle-import': data['vehicle-import'],
    'vehicle-inspection': data['vehicle-inspection'],
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
    },
    autoServiceBelgrade: data.autoServiceBelgrade,
    detailingBelgrade: data.detailingBelgrade,
    caseChrome: {
      ...data.caseChrome,
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
