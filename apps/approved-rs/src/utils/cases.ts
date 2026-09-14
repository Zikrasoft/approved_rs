import type { CollectionEntry } from 'astro:content';
import type { CaseCardProps } from '@/components/CaseCard.astro';
import { getServicesContent } from '@/i18n/content/services';
import { PathBuilder } from '@/utils/paths';
import type { Locale, TranslatableLocale } from '@/i18n/config';

type CaseTranslations = Partial<
  Record<TranslatableLocale, { title: string; body: string }>
>;

// Case bodies are written in ru; every other locale gets an optional
// title+body translation right on the same entry's `translations` field
// (filled in automatically by .github/workflows/translate.yml). No
// translation yet for this locale → undefined, so callers fall back to the
// ru original rather than leaving the page half-broken. A plain `locale`
// index (rather than `locale as TranslatableLocale`) trips a real
// astro-check bug that cascades into unrelated `any` types for the rest of
// the file — narrowing through this function's parameter type avoids it.
//
// Keystatic's text/markdoc fields save as '' when left blank, not omitted
// — a brand-new case's translation object exists with empty title/body the
// moment it's created, before the translation workflow has had a chance to
// run. Checking for a real title (not just key presence) keeps that window
// falling back to ru instead of rendering an empty <h1>/<title>.
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
