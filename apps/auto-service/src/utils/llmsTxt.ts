import { DEVELOPER } from '@podbor/brands';
import { getCollection } from 'astro:content';
import { mapPlaceUrl } from '@podbor/site-kit';
import { renderBrandLlmsTxt } from '@podbor/i18n';
import { SITE_URL, SITE_NAME, GARAGE_ADDRESS } from '@/utils/constants';
import { SERVICE_SLUGS } from '@/utils/services';
import { translated } from '@podbor/catalog-contract';
import {
  categoriesForBuild,
  cataloguePagesForBuild,
  makeHubsForBuild,
  shopOpen,
} from '@/utils/catalogueEnv';
import { categoryAddon } from '@/utils/categoryAddon';
import { formatMoney } from '@/utils/money';
import { paragraphs } from '@podbor/site-kit';
import { localizedWork, publishedWorks } from '@/utils/works';
import { catalogueLinks, PathBuilder } from '@/utils/paths';
import { carName, vehicleVariant } from '@/utils/carName';
import { BCP47_BY_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { content } from '@/i18n/content';

const url = (path: string) => `${SITE_URL}${path}`;

export async function generateLlmsTxt(locale: Locale): Promise<string> {
  const home = content(locale).home;
  const pages = content(locale).pages;
  const services = content(locale).services;
  const site = content(locale).site;
  const works = publishedWorks(await getCollection('works'));
  const categories = await categoriesForBuild();
  const makes = await makeHubsForBuild();
  const links = catalogueLinks(locale, await cataloguePagesForBuild());

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
      {
        heading: site.nav.parts,
        index: {
          label: pages.partsInquiry.heading,
          href: url(PathBuilder.parts(locale)),
          note: shopOpen()
            ? pages.partsInquiry.llmsCatalogue
            : pages.partsInquiry.llmsCatalogueClosed,
        },
        entries: [
          ...categories.map((category) => {
            const addon = categoryAddon(category, locale);
            const money = (price: number) =>
              formatMoney(price, 'RSD', BCP47_BY_LOCALE[locale]);
            const { installationLabel, installationFree } =
              content(locale).shopCart;
            return {
              label: translated(category, 'name', locale),
              href: url(PathBuilder.partsCategory(locale, category.slug)),
              note: [
                paragraphs(translated(category, 'text', locale))[0],
                addon && `${addon.label}: ${money(addon.price)}.`,
                category.installation_price === 0
                  ? `${installationFree}.`
                  : category.installation_price !== null &&
                    `${installationLabel}: ${money(category.installation_price)}.`,
              ]
                .filter(Boolean)
                .join(' '),
            };
          }),
          ...makes.flatMap(({ make, models }) => [
            {
              label: make.name,
              href: url(PathBuilder.partsMake(locale, make.slug)),
              note: content(locale).partsCar.hubs.make.lead,
            },
            ...models.flatMap(({ model, vehicles }) => [
              {
                label: carName(model, locale),
                href: url(
                  PathBuilder.partsModel(locale, make.slug, model.slug),
                ),
              },
              ...vehicles.flatMap((vehicle) => {
                const href = links.vehicle(vehicle);
                return href
                  ? [
                      {
                        label: `${carName(model, locale)}, ${vehicleVariant(vehicle, locale)}`,
                        href: url(href),
                      },
                    ]
                  : [];
              }),
            ]),
          ]),
        ],
      },
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
      { label: pages.bmw.heading, href: url(PathBuilder.bmw(locale)) },
      { label: site.nav.contact, href: url(PathBuilder.contact(locale)) },
      { label: site.footer.aboutLabel, href: url(PathBuilder.about(locale)) },
      {
        label: site.footer.privacyLabel,
        href: url(PathBuilder.privacy(locale)),
      },
    ],
    locales: SUPPORTED_LOCALES,
    credit: `${site.footer.developerCredit}: ${DEVELOPER.url}`,
    locale,
  });
}
