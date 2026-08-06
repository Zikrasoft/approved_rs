import { describe, it, expect } from 'vitest';
import { getHomeContent } from './home';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getHomeContent', () => {
  it('returns all sections with the right array lengths for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const h = getHomeContent(locale);
      expect(h.journey.length).toBe(4);
      expect(h.trustCards.length).toBe(3);
      expect(h.testimonials.length).toBe(3);
    }
  });

  it('testimonial names stay in Cyrillic across every locale (not translated)', () => {
    expect(getHomeContent('en').testimonials[0].name).toBe('Александр');
    expect(getHomeContent('sr').testimonials[0].name).toBe('Александр');
  });

  it('en and sr differ from ru', () => {
    expect(getHomeContent('en').heroLine1).not.toBe(getHomeContent('ru').heroLine1);
    expect(getHomeContent('sr').heroLine1).not.toBe(getHomeContent('ru').heroLine1);
    expect(getHomeContent('en').ctaHeading.accentWord).not.toBe(getHomeContent('ru').ctaHeading.accentWord);
  });
});
