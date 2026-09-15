import { getCollection } from 'astro:content';
import { renderBrandLlmsTxt, type LlmsLinkList } from '@podbor/i18n';
import {
  SITE_URL,
  SITE_NAME,
  GARAGE_ADDRESS,
  SHOP_ENABLED,
} from '@/utils/constants';
import { SERVICE_SLUGS } from '@/utils/services';
import { localizedWork, publishedWorks } from '@/utils/works';
import { PathBuilder } from '@/utils/paths';
import { getHomeContent } from '@/i18n/content/home';
import { getPagesContent } from '@/i18n/content/pages';
import { getServicesContent } from '@/i18n/content/services';
import { getShopContent } from '@/i18n/content/shop';
import { getSiteContent } from '@/i18n/content/site';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';

const url = (path: string) => `${SITE_URL}${path}`;

function shopList(locale: Locale, heading: string): LlmsLinkList[] {
  if (!SHOP_ENABLED) return [];
  const shop = getShopContent(locale);
  return [
    {
      heading,
      index: {
        label: shop.heading,
        href: url(PathBuilder.shop(locale)),
        note: shop.lead,
      },
      entries: [],
    },
  ];
}

export async function generateLlmsTxt(locale: Locale): Promise<string> {
  const home = getHomeContent(locale);
  const pages = getPagesContent(locale);
  const services = getServicesContent(locale);
  const site = getSiteContent(locale);
  const works = publishedWorks(await getCollection('works'));

  return renderBrandLlmsTxt({
    site: { name: SITE_NAME, url: SITE_URL, summary: home.meta.description },
    headings: site.llms,
    facts: [
      ...home.trust.map((fact) => `- ${fact.value} — ${fact.label}`),
      `- ${pages.contact.addressLabel}: ${GARAGE_ADDRESS.street}, ${GARAGE_ADDRESS.district}, ${GARAGE_ADDRESS.city}`,
      `- ${pages.contact.hoursLabel}: ${site.footer.hours}`,
    ],
    lists: [
      {
        heading: site.nav.services,
        index: {
          label: services.indexHeading,
          href: url(PathBuilder.services(locale)),
        },
        entries: SERVICE_SLUGS.map((slug) => ({
          label: services[slug].name,
          href: url(PathBuilder.service(locale, slug)),
          note: services[slug].short,
        })),
      },
      ...shopList(locale, site.nav.shop),
      {
        heading: site.nav.works,
        index: {
          label: pages.works.heading,
          href: url(PathBuilder.works(locale)),
        },
        entries: works.map((work) => ({
          label: localizedWork(work, locale).title,
          href: url(PathBuilder.work(locale, work.id)),
        })),
      },
    ],
    other: [
      { label: site.common.homeLabel, href: url(PathBuilder.home(locale)) },
      { label: site.nav.contact, href: url(PathBuilder.contact(locale)) },
      {
        label: site.footer.privacyLabel,
        href: url(PathBuilder.privacy(locale)),
      },
    ],
    locales: SUPPORTED_LOCALES,
    locale,
  });
}
