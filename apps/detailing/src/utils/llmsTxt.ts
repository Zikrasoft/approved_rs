import { getCollection } from 'astro:content';
import {
  LLMS_HEADINGS,
  llmsLanguageLinks,
  llmsLink,
  renderLlmsTxt,
} from '@podbor/i18n';
import { SITE_URL, SITE_NAME, STUDIO_ADDRESS } from '@/utils/constants';
import { SERVICE_SLUGS } from '@/utils/services';
import { localizedWork, publishedWorks } from '@/utils/works';
import { PathBuilder } from '@/utils/paths';
import { getHomeContent } from '@/i18n/content/home';
import { getPagesContent } from '@/i18n/content/pages';
import { getServicesContent } from '@/i18n/content/services';
import { getSiteContent } from '@/i18n/content/site';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';

export async function generateLlmsTxt(locale: Locale): Promise<string> {
  const home = getHomeContent(locale);
  const pages = getPagesContent(locale);
  const services = getServicesContent(locale);
  const site = getSiteContent(locale);
  const s = LLMS_HEADINGS[locale];
  const works = publishedWorks(await getCollection('works'));

  return renderLlmsTxt(SITE_NAME, home.meta.description, [
    {
      heading: s.keyFacts,
      items: [
        ...home.hero.stats.map((stat) => `- ${stat.value} — ${stat.label}`),
        `- ${pages.contact.addressLabel}: ${STUDIO_ADDRESS.street}, ${STUDIO_ADDRESS.district}, ${STUDIO_ADDRESS.city}`,
        `- ${pages.contact.hoursLabel}: ${site.footer.hours}`,
      ],
    },
    {
      heading: site.nav.services,
      items: [
        llmsLink(
          services.indexHeading,
          `${SITE_URL}${PathBuilder.services(locale)}`,
        ),
        ...SERVICE_SLUGS.map((slug) =>
          llmsLink(
            services[slug].name,
            `${SITE_URL}${PathBuilder.service(locale, slug)}`,
            services[slug].short,
          ),
        ),
      ],
    },
    {
      heading: site.nav.works,
      items: [
        llmsLink(
          pages.works.heading,
          `${SITE_URL}${PathBuilder.works(locale)}`,
        ),
        ...works.map((work) =>
          llmsLink(
            localizedWork(work, locale).title,
            `${SITE_URL}${PathBuilder.work(locale, work.id)}`,
          ),
        ),
      ],
    },
    {
      heading: s.other,
      items: [
        llmsLink(
          site.common.homeLabel,
          `${SITE_URL}${PathBuilder.home(locale)}`,
        ),
        llmsLink(site.nav.contact, `${SITE_URL}${PathBuilder.contact(locale)}`),
        llmsLink(
          site.footer.privacyLabel,
          `${SITE_URL}${PathBuilder.privacy(locale)}`,
        ),
      ],
    },
    {
      heading: s.languages,
      items: llmsLanguageLinks(SITE_URL, SUPPORTED_LOCALES, locale),
    },
  ]);
}
