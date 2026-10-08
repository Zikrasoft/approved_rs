import { describe, it, expect } from 'vitest';
import { translationIsCurrent } from '@podbor/i18n';
import homeYaml from '@/content/i18n/home.yaml?raw';
import { content } from '@/i18n/content';
import { homeContentSchema } from './homeContentSchema';
import { SUPPORTED_LOCALES } from '@/i18n/config';

const translated = translationIsCurrent(homeYaml, homeContentSchema);

describe('content().home', () => {
  it('returns all sections with the right array lengths for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const h = content(locale).home;
      expect(h.journey.length).toBe(4);
      expect(h.trustCards.length).toBe(3);
    }
  });

  it.skipIf(!translated)('en, sr, es and de differ from ru', () => {
    expect(content('en').home.heroLine1).not.toBe(content('ru').home.heroLine1);
    expect(content('sr').home.heroLine1).not.toBe(content('ru').home.heroLine1);
    expect(content('es').home.heroLine1).not.toBe(content('ru').home.heroLine1);
    expect(content('de').home.heroLine1).not.toBe(content('ru').home.heroLine1);
    expect(content('en').home.ctaHeading.accentWord).not.toBe(
      content('ru').home.ctaHeading.accentWord,
    );
  });
});

describe('homeContentSchema', () => {
  it('rejects the closing-band copies of the stats band keys', () => {
    const ru = content('ru').home;
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
