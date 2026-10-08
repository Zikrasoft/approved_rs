import { getCollection } from 'astro:content';
import { mapPlaceUrl } from '@podbor/site-kit';
import { renderBrandLlmsTxt, type LlmsLinkList } from '@podbor/i18n';
import { SITE_URL, SITE_NAME, GARAGE_ADDRESS } from '@/utils/constants';
import { shopCatalog } from '@/lib/catalog';
import { shopTypes } from '@/lib/shopPages';
import { shopIndexed } from '@/utils/shopStatus';
import { SERVICE_SLUGS } from '@/utils/services';
import { localizedWork, publishedWorks } from '@/utils/works';
import { PathBuilder } from '@/utils/paths';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { content } from '@/i18n/content';

const url = (path: string) => `${SITE_URL}${path}`;

async function shopList(
  locale: Locale,
  heading: string,
): Promise<LlmsLinkList[]> {
  if (!shopIndexed()) return [];
  const shop = content(locale).shop;
  const { products } = await shopCatalog().catalog(locale);
  return [
    {
      heading,
      index: {
        label: shop.heading,
        href: url(PathBuilder.shop(locale)),
        note: shop.lead,
      },
      entries: shopTypes(products).map(({ key }) => ({
        label: shop.types[key].name,
        href: url(PathBuilder.shopType(locale, key)),
        note: shop.types[key].lead,
      })),
    },
  ];
}

export async function generateLlmsTxt(locale: Locale): Promise<string> {
  const home = content(locale).home;
  const pages = content(locale).pages;
  const services = content(locale).services;
  const site = content(locale).site;
  const works = publishedWorks(await getCollection('works'));

  return renderBrandLlmsTxt({
    site: { name: SITE_NAME, url: SITE_URL, summary: home.meta.description },
    headings: site.llms,
    facts: [
      ...home.trust.map((fact) => `- ${fact.value} — ${fact.label}`),
      `- ${pages.contact.addressLabel}: ${GARAGE_ADDRESS.street}, ${GARAGE_ADDRESS.district}, ${GARAGE_ADDRESS.city}`,
      `- ${pages.contact.mapHeading}: ${mapPlaceUrl(GARAGE_ADDRESS.googleMapsCid)}`,
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
      ...(await shopList(locale, site.nav.shop)),
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
