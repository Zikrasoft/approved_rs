import { fitmentSchema } from '@podbor/shop-catalog';

import { fitmentComplaint } from '../../lib/vehicle-tree';
import { BATTERIES } from '../battery-fixture';
import { VEHICLES, vehiclesSchema } from '../vehicle-fixture';

const duplicates = (names: string[]): string[] =>
  names.filter((name, index) => names.indexOf(name) !== index);

const models = VEHICLES.flatMap((make) =>
  make.models.map((model) => ({ make: make.name, ...model })),
);

const generations = models.flatMap((model) =>
  model.generations.map((generation) => ({
    car: `${model.make} ${model.name} ${generation.name}`,
    ...generation,
  })),
);

describe('the vehicle fixture', () => {
  it('lists the makes common on the Serbian market', () => {
    expect(VEHICLES.length).toBeGreaterThanOrEqual(20);
    expect(VEHICLES.map((make) => make.name)).toEqual(
      expect.arrayContaining([
        'Audi',
        'BMW',
        'Citroen',
        'Dacia',
        'Fiat',
        'Ford',
        'Honda',
        'Hyundai',
        'Kia',
        'Mazda',
        'Mercedes-Benz',
        'Opel',
        'Peugeot',
        'Renault',
        'Seat',
        'Skoda',
        'Toyota',
        'Volkswagen',
      ]),
    );
  });

  it('names every make, every model of a make and every generation of a model once', () => {
    expect(duplicates(VEHICLES.map((make) => make.name))).toEqual([]);
    for (const make of VEHICLES) {
      expect(duplicates(make.models.map((model) => model.name))).toEqual([]);
      for (const model of make.models) {
        expect(
          duplicates(model.generations.map((generation) => generation.name)),
        ).toEqual([]);
      }
    }
  });

  it('never ends a generation before it starts, and keeps to 2000 onward', () => {
    expect(
      generations.filter((g) => g.yearFrom > g.yearTo).map((g) => g.car),
    ).toEqual([]);
    expect(
      generations
        .filter((g) => g.yearTo < 2000 || g.yearTo > 2026)
        .map((g) => g.car),
    ).toEqual([]);
  });

  it('says where every model came from', () => {
    expect(
      models
        .filter((model) => !model.source.startsWith('https://'))
        .map((model) => `${model.make} ${model.name}`),
    ).toEqual([]);
    expect(
      generations
        .filter(
          (g) => g.source !== undefined && !g.source.startsWith('https://'),
        )
        .map((g) => g.car),
    ).toEqual([]);
  });

  it('covers every car the battery fixture fits, each inside one generation', () => {
    const uncovered = BATTERIES.flatMap((battery) => {
      const complaint = fitmentComplaint(
        VEHICLES,
        fitmentSchema.parse(battery.fitment),
      );
      return complaint ? [`${battery.handle}: ${complaint}`] : [];
    });

    expect(uncovered).toEqual([]);
  });

  it('refuses a model with no source, a generation source that is not https and reversed years', () => {
    const first = { name: 'I', yearFrom: 2006, yearTo: 2013 };
    const tree = (
      generation: object,
      model: object = { source: 'https://example.org/proto' },
    ) => [
      {
        name: 'Zikra',
        models: [{ name: 'Proto', ...model, generations: [generation] }],
      },
    ];

    expect(vehiclesSchema.safeParse(tree(first)).success).toBe(true);
    expect(vehiclesSchema.safeParse(tree(first, {})).success).toBe(false);
    expect(
      vehiclesSchema.safeParse(
        tree({ ...first, source: 'http://example.org/proto-i' }),
      ).success,
    ).toBe(false);
    expect(
      vehiclesSchema.safeParse(tree({ ...first, yearFrom: 2014 })).success,
    ).toBe(false);
  });
});
