import { describe, it, expect } from 'vitest';
import { content } from '@/i18n/content';
import { homeContentSchema } from './homeContentSchema';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('content().home', () => {
  it('returns all sections with the right array lengths for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const h = content(locale).home;
      expect(h.journey.length).toBe(4);
      expect(h.trustCards.length).toBe(3);
    }
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
