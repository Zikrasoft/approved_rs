import { describe, expect, it } from 'vitest';
import { vehicleFitment, vehicleTreeSchema } from './vehicles.ts';

const TREE = {
  makes: [
    {
      name: 'Toyota',
      models: [
        {
          name: 'Corolla',
          generations: [
            { name: 'E170', yearFrom: 2013, yearTo: 2019 },
            { name: 'E210', yearFrom: 2018, yearTo: 2026 },
          ],
        },
      ],
    },
    { name: 'Lada', models: [] },
  ],
};

describe('vehicleTreeSchema', () => {
  it('accepts the dictionary as the store route serves it', () => {
    expect(vehicleTreeSchema.parse(TREE)).toEqual(TREE);
  });

  it('refuses a tree that leaks an internal id or a source link', () => {
    const leaked = structuredClone(TREE) as Record<string, unknown> &
      typeof TREE;
    (leaked.makes[0] as Record<string, unknown>).id = 'vmake_1';
    expect(vehicleTreeSchema.safeParse(leaked).success).toBe(false);
    const sourced = structuredClone(TREE);
    (sourced.makes[0].models[0] as Record<string, unknown>).source =
      'https://x';
    expect(vehicleTreeSchema.safeParse(sourced).success).toBe(false);
  });

  it('refuses a year outside what a car can have', () => {
    const odd = structuredClone(TREE);
    odd.makes[0].models[0].generations[0].yearFrom = 1800;
    expect(vehicleTreeSchema.safeParse(odd).success).toBe(false);
  });
});

describe('vehicleFitment', () => {
  it('turns every generation into one fitment entry', () => {
    expect(vehicleFitment(TREE)).toEqual([
      { make: 'Toyota', model: 'Corolla', yearFrom: 2013, yearTo: 2019 },
      { make: 'Toyota', model: 'Corolla', yearFrom: 2018, yearTo: 2026 },
    ]);
  });
});
