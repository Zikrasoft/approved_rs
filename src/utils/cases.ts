import type { CollectionEntry } from 'astro:content';
import type { CaseCardProps } from '../components/CaseCard.astro';
import { getServicesContent } from '../i18n/content/services';
import type { Locale } from '../i18n/config';

export const toCaseItem = (c: CollectionEntry<'cases'>, locale: Locale): CaseCardProps => {
  const badgeMap = getServicesContent(locale).caseChrome.serviceBadges;
  return {
    href: `/${locale}/cases/${c.id}/`,
    image: c.data.image,
    imageAlt: c.data.car,
    badges: [badgeMap[c.data.service as keyof typeof badgeMap] ?? c.data.service],
    car: c.data.car,
    year: c.data.year,
    price: c.data.price,
  };
};

export const toAutoserviceCaseItem = (c: CollectionEntry<'autoserviceCases'>, locale: Locale): CaseCardProps => {
  const workLabels = Object.fromEntries(getServicesContent(locale).avtoservisBelgrade.whatWeDo.map(w => [w.key, w.label]));
  return {
    href: `/${locale}/avtoservis-belgrade/${c.id}/`,
    image: c.data.image,
    imageAlt: c.data.car,
    badges: c.data.servicesApplied.map(s => workLabels[s] ?? s),
    car: c.data.car,
    year: c.data.year,
    price: c.data.price,
  };
};
