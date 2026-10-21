import { describe, expect, it } from 'vitest';
import { carName, vehicleVariant } from './carName';

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

  it('names a variant by engine, power and years', () => {
    expect(
      vehicleVariant(
        {
          engine: { code: 'B47D20O0' },
          power_kw: 140,
          year_from: 2015,
          year_to: null,
        },
        'ru',
      ),
    ).toBe('B47D20O0, 140 кВт, 2015–по наст. время');
  });

  it('leaves out what the catalogue does not know about a variant', () => {
    expect(
      vehicleVariant(
        {
          engine: { code: 'N47D20' },
          power_kw: null,
          year_from: null,
          year_to: null,
        },
        'ru',
      ),
    ).toBe('N47D20');
  });

  it('falls back to the Russian series name until a translation exists', () => {
    expect(carName(model(null), 'sr')).toBe('BMW 3 серия F30 320d');
    expect(carName(model({ en: '3 Series' }), 'ru')).toBe(
      'BMW 3 серия F30 320d',
    );
  });
});
