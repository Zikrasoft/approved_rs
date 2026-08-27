import type { CollectionEntry } from 'astro:content';
import type { CaseCardProps } from '@/components/CaseCard.astro';
import { getServicesContent } from '@/i18n/content/services';
import { PathBuilder } from '@/utils/paths';
import type { Locale } from '@/i18n/config';

export const toCaseItem = (c: CollectionEntry<'cases'>, locale: Locale): CaseCardProps => {
  const badgeMap = getServicesContent(locale).caseChrome.serviceBadges;
  return {
    href: PathBuilder.case(locale, c.id),
    image: c.data.image,
    imageAlt: c.data.car,
    badges: [badgeMap[c.data.service as keyof typeof badgeMap] ?? c.data.service],
    car: c.data.car,
    year: c.data.year,
    price: c.data.price,
  };
};

type WorkCaseEntry = CollectionEntry<'autoserviceCases'> | CollectionEntry<'detailingCases'>;

// auto-service and detailing cases share the same shape (car/title/year +
// tags into a per-service "what we do" list) — one mapper parameterized by
// the bit that actually differs, instead of two near-identical copies.
function toWorkCaseItem<T extends WorkCaseEntry>(
  c: T,
  locale: Locale,
  whatWeDo: { key: string; label: string }[],
  buildHref: (locale: Locale, caseId: string) => string,
): CaseCardProps {
  const workLabels = Object.fromEntries(whatWeDo.map(w => [w.key, w.label]));
  const car = c.data.car ?? c.data.title;
  return {
    href: buildHref(locale, c.id),
    image: c.data.image,
    imageAlt: car,
    badges: c.data.servicesApplied.map(s => workLabels[s] ?? s),
    car,
    // Year is the car's model year — meaningless to show without the car.
    year: c.data.car ? c.data.year : undefined,
  };
}

export const toAutoserviceCaseItem = (c: CollectionEntry<'autoserviceCases'>, locale: Locale): CaseCardProps =>
  toWorkCaseItem(c, locale, getServicesContent(locale).autoServiceBelgrade.whatWeDo, PathBuilder.autoServiceCase);

export const toDetailingCaseItem = (c: CollectionEntry<'detailingCases'>, locale: Locale): CaseCardProps =>
  toWorkCaseItem(c, locale, getServicesContent(locale).detailingBelgrade.whatWeDo, PathBuilder.detailingCase);
