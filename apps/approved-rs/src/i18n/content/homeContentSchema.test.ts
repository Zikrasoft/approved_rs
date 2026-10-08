import { describe, it, expect } from 'vitest';
import { content } from '@/i18n/content';
import { homeContentSchema } from './homeContentSchema';

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
