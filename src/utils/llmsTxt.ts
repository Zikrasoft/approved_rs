import { SITE_URL, SITE_NAME } from '@/utils/constants';
import { SERVICES } from '@/utils/labels';
import { getI18n } from '@/i18n/getI18n';
import { getActiveCountries, getCitiesForCountry } from '@/utils/geo';
import { getPublishedCases, getPublishedAutoserviceCases } from '@/utils/casesQueries';
import { getServicesContent } from '@/i18n/content/services';
import { getHomeContent } from '@/i18n/content/home';
import { buildLocation } from '@/utils/seo';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';

// 'cases' isn't here — it's byte-identical to the existing nav.cases
// dictionary entry, reused directly below instead of duplicating it.
const SECTION_HEADINGS: Record<Locale, Record<'countries' | 'cities' | 'privoz' | 'other' | 'languages', string>> = {
  ru: { countries: 'Услуги по странам', cities: 'Автоподбор по городам', privoz: 'Привоз авто', other: 'Прочее', languages: 'Другие языки' },
  en: { countries: 'Services by Country', cities: 'Car Sourcing by City', privoz: 'Car Import', other: 'Other', languages: 'Other Languages' },
  sr: { countries: 'Usluge po zemljama', cities: 'Odabir vozila po gradovima', privoz: 'Uvoz vozila', other: 'Ostalo', languages: 'Drugi jezici' },
};

const CASE_COUNT_LABELS: Record<Locale, { autopodbor: (n: number) => string; autoservice: (n: number) => string }> = {
  ru: {
    autopodbor: (n) => `${n} реализованных подборов с автомобилем, страной и ценой`,
    autoservice: (n) => `${n} примеров ремонта и обслуживания в Белграде`,
  },
  en: {
    autopodbor: (n) => `${n} completed sourcing cases with car, country, and price`,
    autoservice: (n) => `${n} repair and maintenance examples in Belgrade`,
  },
  sr: {
    autopodbor: (n) => `${n} realizovanih primera odabira sa vozilom, zemljom i cenom`,
    autoservice: (n) => `${n} primera popravke i održavanja u Beogradu`,
  },
};

export async function generateLlmsTxt(locale: Locale): Promise<string> {
  const countries = getActiveCountries();
  const cases = await getPublishedCases();
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
      lines.push(`- [${nav[service.slug]} ${buildLocation(locale, country)}](${SITE_URL}/${locale}/${service.slug}/${country.code}/)`);
    }
  }
  lines.push('');

  lines.push(`## ${s.cities}`, '');
  for (const country of countries) {
    for (const city of getCitiesForCountry(country.code)) {
      lines.push(`- [${nav.autopodbor} ${buildLocation(locale, undefined, city)}](${SITE_URL}/${locale}/autopodbor/${country.code}/${city.slug}/)`);
    }
  }
  lines.push('');

  lines.push(`## ${s.privoz}`, '');
  lines.push(`- [${sc.privoz.hub.title}](${SITE_URL}/${locale}/privoz/)`);
  lines.push(`- [${sc.privoz.de.title}](${SITE_URL}/${locale}/privoz/de/)`);
  lines.push(`- [${sc.privoz.eu.title}](${SITE_URL}/${locale}/privoz/eu/)`);
  lines.push(`- [${sc.privoz.china.title}](${SITE_URL}/${locale}/privoz/china/)`);
  lines.push('');

  lines.push(`## ${nav.cases}`, '');
  lines.push(`- [${nav.cases}](${SITE_URL}/${locale}/cases/autopodbor/) — ${cc.autopodbor(cases.length)}`);
  lines.push(`- [${sc.avtoservisBelgrade.worksHeading}](${SITE_URL}/${locale}/cases/autoservice/) — ${cc.autoservice(autoserviceCases.length)}`);
  lines.push('');

  lines.push(`## ${s.other}`, '');
  lines.push(`- [${t.common.homeLabel}](${SITE_URL}/${locale}/)`);
  lines.push(`- [${nav.contacts}](${SITE_URL}/${locale}/contacts/)`);
  lines.push('');

  lines.push(`## ${s.languages}`, '');
  for (const other of SUPPORTED_LOCALES) {
    if (other === locale) continue;
    lines.push(`- ${SITE_URL}/${other}/llms.txt`);
  }

  return lines.join('\n') + '\n';
}
