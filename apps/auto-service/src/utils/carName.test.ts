import { describe, expect, it } from 'vitest';
import { byModelName, carName, modelName, vehicleVariant } from './carName';

describe('byModelName', () => {
  it('orders models by their own name in natural order, then by chassis', () => {
    const entry = (name: string, code: string) => ({
      model: { name, chassis: { code } },
    });

    expect(
      [
        entry('Octavia 2.0 TDI', 'NX'),
        entry('320d', 'G20'),
        entry('Octavia 2.0 TDI', '5E'),
        entry('118d', 'F20'),
        entry('20d', 'F30'),
      ]
        .sort(byModelName)
        .map(({ model }) => `${model.name} ${model.chassis.code}`),
    ).toEqual([
      '20d F30',
      '118d F20',
      '320d G20',
      'Octavia 2.0 TDI 5E',
      'Octavia 2.0 TDI NX',
    ]);
  });
});

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

  it('says a series once when the catalogue reused it as the chassis code and the model name repeats it', () => {
    const bus = {
      name: 'MB 200 DKDL',
      chassis: {
        code: 'MB',
        series: {
          name: 'MB',
          translations: null,
          make: { name: 'DAF BUS (VDL BUS GROUP)' },
        },
      },
    };
    expect(carName(bus, 'en')).toBe('DAF BUS (VDL BUS GROUP) MB 200 DKDL');
    expect(
      carName(
        {
          name: '1.6 GDI',
          chassis: {
            ...bus.chassis,
            code: 'Veloster',
            series: {
              ...bus.chassis.series,
              name: 'Veloster',
              make: { name: 'HYUNDAI' },
            },
          },
        },
        'en',
      ),
    ).toBe('HYUNDAI Veloster 1.6 GDI');
  });
});

describe('modelName', () => {
  const crawled = {
    name: '2.0 d (E83)',
    chassis: {
      code: 'E83',
      series: { name: 'X3', translations: null, make: { name: 'BMW' } },
    },
  };

  it('names the series a crawled model belongs to, without repeating its chassis', () => {
    expect(modelName(crawled, 'ru')).toBe('X3 2.0 d (E83)');
    expect(carName(crawled, 'ru')).toBe('BMW X3 2.0 d (E83)');
  });

  it('names the model without its make', () => {
    expect(modelName(model({ en: '3 Series' }), 'en')).toBe(
      '3 Series F30 320d',
    );
  });
});
