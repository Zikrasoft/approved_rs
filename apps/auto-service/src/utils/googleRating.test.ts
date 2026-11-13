import { describe, expect, it, vi } from 'vitest';
import { fetchGoogleRating, googleRatingLabel } from './googleRating';

const env = { GOOGLE_PLACES_API_KEY: 'key', GOOGLE_PLACE_ID: 'place/1' };
const fallback = { rating: '5.0', reviews: 22 };
const answer = (body: unknown, status = 200) =>
  vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('googleRatingLabel', () => {
  it('states the rating and review count, from constants without Places keys', () => {
    expect(googleRatingLabel('ru')).toBe('5.0 в Google · 22 отзыва');
  });

  it('agrees the review word with the count', () => {
    const label = (reviews: number) =>
      googleRatingLabel('ru', { rating: '4.9', reviews });

    expect(label(21)).toBe('4.9 в Google · 21 отзыв');
    expect(label(23)).toBe('4.9 в Google · 23 отзыва');
    expect(label(25)).toBe('4.9 в Google · 25 отзывов');
  });
});

describe('fetchGoogleRating', () => {
  it('asks Places for the rating and count of the configured place', async () => {
    const fetcher = answer({ rating: 4.86, userRatingCount: 19 });

    expect(await fetchGoogleRating(env, fetcher)).toEqual({
      rating: '4.9',
      reviews: 19,
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://places.googleapis.com/v1/places/place%2F1');
    expect(init?.headers).toEqual({
      'X-Goog-Api-Key': 'key',
      'X-Goog-FieldMask': 'rating,userRatingCount',
    });
  });

  it('keeps the constants and asks nothing without both keys', async () => {
    const fetcher = answer({});

    expect(
      await fetchGoogleRating({ GOOGLE_PLACES_API_KEY: 'key' }, fetcher),
    ).toEqual(fallback);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['an error status', answer({ error: 'denied' }, 403)],
    ['a malformed body', answer({ rating: 'five' })],
    ['a network failure', vi.fn<typeof fetch>().mockRejectedValue('offline')],
  ])('keeps the constants on %s', async (_, fetcher) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await fetchGoogleRating(env, fetcher)).toEqual(fallback);
    expect(console.warn).toHaveBeenCalled();
  });
});
