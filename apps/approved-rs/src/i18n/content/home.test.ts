import { describe, it, expect } from 'vitest';
import { translationIsCurrent } from '@podbor/i18n';
import homeYaml from '@/content/i18n/home.yaml?raw';
import { getHomeContent } from './home';
import { homeContentSchema } from './homeContentSchema';
import { SUPPORTED_LOCALES } from '@/i18n/config';

const translated = translationIsCurrent(homeYaml, homeContentSchema);

describe('getHomeContent', () => {
  it('returns all sections with the right array lengths for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const h = getHomeContent(locale);
      expect(h.journey.length).toBe(4);
      expect(h.trustCards.length).toBe(3);
    }
  });

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

describe('homeContentSchema', () => {
  it('rejects the closing-band copies of the stats band keys', () => {
    const ru = getHomeContent('ru');
    expect(homeContentSchema.safeParse(ru).success).toBe(true);
    for (const stray of [
      'ctaStatClients',
      'ctaStatCountries',
      'ctaStatYears',
    ]) {
      const result = homeContentSchema.safeParse({
        ...ru,
        [stray]: { value: '200+', label: 'клиентов' },
      });
      expect(result.success, stray).toBe(false);
    }
  });
});
