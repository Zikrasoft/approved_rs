import { SITE_URL, SITE_NAME } from '@/utils/constants';
import { SERVICES } from '@/utils/labels';
import { getI18n } from '@/i18n/getI18n';
import { getActiveCountries, getCitiesForCountry } from '@/utils/geo';
import { getPublishedCasesByService, getPublishedAutoserviceCases } from '@/utils/casesQueries';
import { getServicesContent } from '@/i18n/content/services';
import { getHomeContent } from '@/i18n/content/home';
import { buildLocation } from '@/utils/seo';
import { PathBuilder } from '@/utils/paths';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';

// 'cases' isn't here — it's byte-identical to the existing nav.cases
// dictionary entry, reused directly below instead of duplicating it.
const SECTION_HEADINGS: Record<Locale, Record<'countries' | 'cities' | 'vehicleImport' | 'other' | 'languages', string>> = {
  ru: { countries: 'Услуги по странам', cities: 'Автоподбор по городам', vehicleImport: 'Привоз авто', other: 'Прочее', languages: 'Другие языки' },
  en: { countries: 'Services by Country', cities: 'Car Sourcing by City', vehicleImport: 'Car Import', other: 'Other', languages: 'Other Languages' },
  sr: { countries: 'Usluge po zemljama', cities: 'Odabir vozila po gradovima', vehicleImport: 'Uvoz vozila', other: 'Ostalo', languages: 'Drugi jezici' },
};

const CASE_COUNT_LABELS: Record<Locale, { 'vehicle-sourcing': (n: number) => string; 'auto-service-belgrade': (n: number) => string }> = {
  ru: {
    'vehicle-sourcing': (n) => `${n} реализованных подборов с автомобилем, страной и ценой`,
    'auto-service-belgrade': (n) => `${n} примеров ремонта и обслуживания в Белграде`,
  },
  en: {
    'vehicle-sourcing': (n) => `${n} completed sourcing cases with car, country, and price`,
    'auto-service-belgrade': (n) => `${n} repair and maintenance examples in Belgrade`,
  },
  sr: {
    'vehicle-sourcing': (n) => `${n} realizovanih primera odabira sa vozilom, zemljom i cenom`,
    'auto-service-belgrade': (n) => `${n} primera popravke i održavanja u Beogradu`,
  },
};

export async function generateLlmsTxt(locale: Locale): Promise<string> {
  const countries = getActiveCountries();
  const cases = await getPublishedCasesByService('vehicle-sourcing');
  const autoserviceCases = await getPublishedAutoserviceCases();
  const t = getI18n(locale);
  const nav = t.nav;
  const sc = getServicesContent(locale);
  const h = getHomeContent(locale);
  const s = SECTION_HEADINGS[locale];
  const cc = CASE_COUNT_LABELS[locale];

  const lines: string[] = [];

  lines.push(`# ${SITE_NAME}`, '');
  lines.push(`> ${h.metaDescription}`, '');

  lines.push(`## ${s.countries}`, '');
  for (const country of countries) {
    for (const service of SERVICES) {
      lines.push(`- [${nav[service.slug]} ${buildLocation(locale, country)}](${SITE_URL}${PathBuilder.service(locale, service.slug, country.code)})`);
    }
  }
  lines.push('');

  lines.push(`## ${s.cities}`, '');
  for (const country of countries) {
    for (const city of getCitiesForCountry(country.code)) {
      lines.push(`- [${nav['vehicle-sourcing']} ${buildLocation(locale, undefined, city)}](${SITE_URL}${PathBuilder.vehicleSourcingCity(locale, country.code, city.slug)})`);
    }
  }
  lines.push('');

  lines.push(`## ${s.vehicleImport}`, '');
  lines.push(`- [${sc['vehicle-import'].hub.title}](${SITE_URL}${PathBuilder.vehicleImportHub(locale)})`);
  lines.push(`- [${sc['vehicle-import'].de.title}](${SITE_URL}${PathBuilder.vehicleImportSpoke(locale, 'de')})`);
  lines.push(`- [${sc['vehicle-import'].es.title}](${SITE_URL}${PathBuilder.vehicleImportSpoke(locale, 'es')})`);
  lines.push(`- [${sc['vehicle-import'].ch.title}](${SITE_URL}${PathBuilder.vehicleImportSpoke(locale, 'ch')})`);
  lines.push(`- [${sc['vehicle-import'].eu.title}](${SITE_URL}${PathBuilder.vehicleImportSpoke(locale, 'eu')})`);
  lines.push(`- [${sc['vehicle-import'].china.title}](${SITE_URL}${PathBuilder.vehicleImportSpoke(locale, 'china')})`);
  lines.push('');

  lines.push(`## ${nav.cases}`, '');
  lines.push(`- [${nav.cases}](${SITE_URL}${PathBuilder.casesVehicleSourcing(locale)}) — ${cc['vehicle-sourcing'](cases.length)}`);
  lines.push(`- [${sc.autoServiceBelgrade.worksHeading}](${SITE_URL}${PathBuilder.casesAutoService(locale)}) — ${cc['auto-service-belgrade'](autoserviceCases.length)}`);
  lines.push('');

  lines.push(`## ${s.other}`, '');
  lines.push(`- [${t.common.homeLabel}](${SITE_URL}${PathBuilder.home(locale)})`);
  lines.push(`- [${nav.contacts}](${SITE_URL}${PathBuilder.contacts(locale)})`);
  lines.push('');

  lines.push(`## ${s.languages}`, '');
  for (const other of SUPPORTED_LOCALES) {
    if (other === locale) continue;
    lines.push(`- ${SITE_URL}/${other}/llms.txt`);
  }

  return lines.join('\n') + '\n';
}
