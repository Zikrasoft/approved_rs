import { describe, expect, it } from 'vitest';
import { googleRatingLabel } from './googleRating';

describe('googleRatingLabel', () => {
  it('states the checked rating and review count', () => {
    expect(googleRatingLabel('ru')).toBe('5.0 в Google · 14 отзывов');
  });

  it('agrees the review word with the count', () => {
    const label = (reviews: number) =>
      googleRatingLabel('ru', { rating: '4.9', reviews, checkedOn: '' });

    expect(label(21)).toBe('4.9 в Google · 21 отзыв');
    expect(label(23)).toBe('4.9 в Google · 23 отзыва');
    expect(label(25)).toBe('4.9 в Google · 25 отзывов');
  });
});
