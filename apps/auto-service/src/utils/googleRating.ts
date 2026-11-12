import { z } from 'zod';
import { BCP47_BY_LOCALE, type Locale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { GOOGLE_RATING } from '@/utils/constants';
import { plural } from '@/utils/leadTime';

type GoogleRating = Pick<typeof GOOGLE_RATING, 'rating' | 'reviews'>;

const placesEnvSchema = z.object({
  GOOGLE_PLACES_API_KEY: z.string().min(1),
  GOOGLE_PLACE_ID: z.string().min(1),
});

const placeSchema = z.object({
  rating: z.number().min(1).max(5),
  userRatingCount: z.number().int().positive(),
});

export async function fetchGoogleRating(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<GoogleRating> {
  const fallback = {
    rating: GOOGLE_RATING.rating,
    reviews: GOOGLE_RATING.reviews,
  };
  const keys = placesEnvSchema.safeParse(env);
  if (!keys.success) return fallback;
  try {
    const response = await fetcher(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(keys.data.GOOGLE_PLACE_ID)}`,
      {
        headers: {
          'X-Goog-Api-Key': keys.data.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'rating,userRatingCount',
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error(`Places API answered ${response.status}`);
    const place = placeSchema.parse(await response.json());
    return { rating: place.rating.toFixed(1), reviews: place.userRatingCount };
  } catch (error) {
    console.warn(
      `Google rating not fetched, using ${fallback.reviews} reviews from constants:`,
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

const liveRating = await fetchGoogleRating();

export function googleRatingLabel(
  locale: Locale,
  { rating, reviews }: GoogleRating = liveRating,
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
