import {
  LLMS_HEADINGS,
  llmsLanguageLinks,
  llmsLink,
  renderLlmsTxt,
} from '@podbor/i18n';
import { SITE_URL, SITE_NAME } from '@/utils/constants';
import { SERVICES } from '@/utils/labels';
import { getI18n } from '@/i18n/getI18n';
import { getActiveCountries, getCitiesForCountry } from '@/utils/geo';
import { getPublishedCasesByService } from '@/utils/casesQueries';
import { getServicesContent } from '@/i18n/content/services';
import { getHomeContent } from '@/i18n/content/home';
import { getFaq } from '@/i18n/content/faq';
import { buildLocation } from '@/utils/seo';
import { PathBuilder } from '@/utils/paths';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';

const SECTION_HEADINGS: Record<
  Locale,
  Record<'countries' | 'cities' | 'vehicleImport', string>
> = {
  ru: {
    countries: 'Услуги по странам',
    cities: 'Автоподбор по городам',
    vehicleImport: 'Привоз авто',
  },
  en: {
    countries: 'Services by Country',
    cities: 'Car Sourcing by City',
    vehicleImport: 'Car Import',
  },
  sr: {
    countries: 'Usluge po zemljama',
    cities: 'Odabir vozila po gradovima',
    vehicleImport: 'Uvoz vozila',
  },
  es: {
    countries: 'Servicios por país',
    cities: 'Búsqueda de autos por ciudad',
    vehicleImport: 'Importación de autos',
  },
  de: {
    countries: 'Leistungen nach Land',
    cities: 'Fahrzeugbeschaffung nach Stadt',
    vehicleImport: 'Fahrzeugimport',
  },
};

const CASE_COUNT_LABELS: Record<
  Locale,
  {
    'vehicle-sourcing': (n: number) => string;
  }
> = {
  ru: {
    'vehicle-sourcing': (n) =>
      `${n} реализованных подборов с автомобилем, страной и ценой`,
  },
  en: {
    'vehicle-sourcing': (n) =>
      `${n} completed sourcing cases with car, country, and price`,
  },
  sr: {
    'vehicle-sourcing': (n) =>
      `${n} realizovanih primera odabira sa vozilom, zemljom i cenom`,
  },
  es: {
    'vehicle-sourcing': (n) =>
      `${n} búsquedas completadas con auto, país y precio`,
  },
  de: {
    'vehicle-sourcing': (n) =>
      `${n} abgeschlossene Beschaffungen mit Auto, Land und Preis`,
  },
};

const IMPORT_SPOKES = ['de', 'es', 'ch', 'eu', 'china'] as const;

export async function generateLlmsTxt(locale: Locale): Promise<string> {
  const countries = getActiveCountries();
  const cases = await getPublishedCasesByService('vehicle-sourcing');
  const t = getI18n(locale);
  const nav = t.nav;
  const sc = getServicesContent(locale);
  const h = getHomeContent(locale);
  const s = SECTION_HEADINGS[locale];
  const shared = LLMS_HEADINGS[locale];
  const cc = CASE_COUNT_LABELS[locale];
  const paymentFaq = getFaq(locale).general[0];

  return renderLlmsTxt(SITE_NAME, h.metaDescription, [
    {
      heading: shared.keyFacts,
      items: [
        `- ${h.statClients.value} ${h.statClients.label}, ${countries.length} ${h.statCountries.label}, ${h.statYears.value} ${h.statYears.label}.`,
        ...(paymentFaq ? [`- ${paymentFaq.a}`] : []),
        `- ${h.ctaSubtext}`,
      ],
    },
    {
      heading: s.countries,
      items: countries.flatMap((country) =>
        SERVICES.map((service) =>
          llmsLink(
            `${nav[service.slug]} ${buildLocation(locale, country)}`,
            `${SITE_URL}${PathBuilder.service(locale, service.slug, country.code)}`,
          ),
        ),
      ),
    },
    {
      heading: s.cities,
      items: countries.flatMap((country) =>
        getCitiesForCountry(country.code).map((city) =>
          llmsLink(
            `${nav['vehicle-sourcing']} ${buildLocation(locale, undefined, city)}`,
            `${SITE_URL}${PathBuilder.vehicleSourcingCity(locale, country.code, city.slug)}`,
          ),
        ),
      ),
    },
    {
      heading: s.vehicleImport,
      items: [
        llmsLink(
          sc['vehicle-import'].hub.title,
          `${SITE_URL}${PathBuilder.vehicleImportHub(locale)}`,
        ),
        ...IMPORT_SPOKES.map((spoke) =>
          llmsLink(
            sc['vehicle-import'][spoke].title,
            `${SITE_URL}${PathBuilder.vehicleImportSpoke(locale, spoke)}`,
          ),
        ),
      ],
    },
    {
      heading: nav.cases,
      items: [
        llmsLink(
          nav.cases,
          `${SITE_URL}${PathBuilder.casesVehicleSourcing(locale)}`,
          cc['vehicle-sourcing'](cases.length),
        ),
      ],
    },
    {
      heading: shared.other,
      items: [
        llmsLink(t.common.homeLabel, `${SITE_URL}${PathBuilder.home(locale)}`),
        llmsLink(nav.contacts, `${SITE_URL}${PathBuilder.contacts(locale)}`),
      ],
    },
    {
      heading: shared.languages,
      items: llmsLanguageLinks(SITE_URL, SUPPORTED_LOCALES, locale),
    },
  ]);
}
