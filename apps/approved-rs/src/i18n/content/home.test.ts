import { describe, it, expect } from 'vitest';
import { translationIsCurrent } from '@podbor/i18n';
import homeYaml from '@/content/i18n/home.yaml?raw';
import { getHomeContent } from './home';
import { homeContentSchema } from './homeContentSchema';
import { SUPPORTED_LOCALES } from '@/i18n/config';

// ru is hand-edited and CI translates on push, so between the two every other
// locale legitimately reads ru. Skipping keeps the guard on the state CI
// produces without turning every Russian copy edit into a red build.
const translated = translationIsCurrent(homeYaml, homeContentSchema);

describe('getHomeContent', () => {
  it('returns all sections with the right array lengths for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const h = getHomeContent(locale);
      expect(h.journey.length).toBe(4);
      expect(h.trustCards.length).toBe(3);
      expect(h.testimonials.length).toBe(3);
    }
  });

  it.skipIf(!translated)(
    'testimonial names stay in Cyrillic across every locale (not translated)',
    () => {
      expect(getHomeContent('en').testimonials[0].name).toBe('Александр');
      expect(getHomeContent('sr').testimonials[0].name).toBe('Александр');
    },
  );

  it.skipIf(!translated)('en, sr, es and de differ from ru', () => {
    expect(getHomeContent('en').heroLine1).not.toBe(
      getHomeContent('ru').heroLine1,
    );
    expect(getHomeContent('sr').heroLine1).not.toBe(
      getHomeContent('ru').heroLine1,
    );
    expect(getHomeContent('es').heroLine1).not.toBe(
      getHomeContent('ru').heroLine1,
    );
    expect(getHomeContent('de').heroLine1).not.toBe(
      getHomeContent('ru').heroLine1,
    );
    expect(getHomeContent('en').ctaHeading.accentWord).not.toBe(
      getHomeContent('ru').ctaHeading.accentWord,
    );
  });
});
