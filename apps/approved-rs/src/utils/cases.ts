import type { CollectionEntry } from 'astro:content';
import type { CaseCardProps } from '@/components/CaseCard.astro';
import { getServicesContent } from '@/i18n/content/services';
import { PathBuilder } from '@/utils/paths';
import type { Locale, TranslatableLocale } from '@/i18n/config';

type CaseTranslations = Partial<
  Record<TranslatableLocale, { title: string; body: string }>
>;

export function getCaseTranslation(
  data: { translations?: CaseTranslations },
  locale: Locale,
): { title: string; body: string } | undefined {
  if (locale === 'ru') return undefined;
  const translation = data.translations?.[locale];
  return translation?.title ? translation : undefined;
}

export const toCaseItem = (
  c: CollectionEntry<'cases'>,
  locale: Locale,
): CaseCardProps => {
  const badgeMap = getServicesContent(locale).caseChrome.serviceBadges;
  return {
    href: PathBuilder.case(locale, c.id),
    image: c.data.image,
    imageAlt: c.data.car,
    badges: [
      badgeMap[c.data.service as keyof typeof badgeMap] ?? c.data.service,
    ],
    car: c.data.car,
    year: c.data.year,
    price: c.data.price,
  };
};
