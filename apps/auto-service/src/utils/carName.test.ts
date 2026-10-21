import { describe, expect, it } from 'vitest';
import { carName } from './carName';

const model = (translations: { sr?: string; en?: string } | null) => ({
  name: '320d',
  chassis: {
    code: 'F30',
    series: {
      name: '3 серия',
      translations,
      make: { name: 'BMW' },
    },
  },
});

describe('carName', () => {
  it('names the car in the page locale', () => {
    expect(carName(model({ en: '3 Series' }), 'en')).toBe(
      'BMW 3 Series F30 320d',
    );
  });

  it('falls back to the Russian series name until a translation exists', () => {
    expect(carName(model(null), 'sr')).toBe('BMW 3 серия F30 320d');
    expect(carName(model({ en: '3 Series' }), 'ru')).toBe(
      'BMW 3 серия F30 320d',
    );
  });
});
