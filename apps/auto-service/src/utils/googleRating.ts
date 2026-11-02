import { BCP47_BY_LOCALE, type Locale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { GOOGLE_RATING } from '@/utils/constants';
import { plural } from '@/utils/leadTime';

export function googleRatingLabel(
  locale: Locale,
  { rating, reviews } = GOOGLE_RATING,
): string {
  const copy = content(locale).site.googleRating;
  return [
    copy.rating.replace('{rating}', rating),
    plural(reviews, copy.reviews, BCP47_BY_LOCALE[locale]).replace(
      '{count}',
      String(reviews),
    ),
  ].join(' · ');
}
