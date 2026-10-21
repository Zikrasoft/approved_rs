import { describe, expect, it } from 'vitest';

import {
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  vinSchema,
  type Vehicle,
} from './vehicle.ts';

const vehicle: Vehicle = {
  id: 'veh_1',
  power_kw: 140,
  drive: 'rwd',
  market: 'EU',
  year_from: 2015,
  year_to: 2019,
  steering: 'left',
  model: {
    slug: 'f30-320d',
    name: '320d',
    chassis: {
      code: 'F30',
      body_style: 'sedan',
      series: {
        name: '3 серия',
        translations: { sr: 'Serija 3', en: '3 Series' },
        make: { slug: 'bmw', name: 'BMW' },
      },
    },
  },
  engine: {
    code: 'B47D20O0',
    family: 'B47',
    fuel: 'diesel',
    displacement_cc: 1995,
  },
  identifiers: [{ type: 'bmw-type-code', value: '35BG' }],
  requirements: [
    {
      id: 'requirement_1',
      category_id: 'category_oil',
      field_key: 'approvals',
      option_keys: ['bmw-ll-04'],
      min: null,
      max: null,
      quantity: 1,
    },
  ],
};

describe('vehiclesResponseSchema', () => {
  it('reads the vehicle list and drops what the contract does not name', () => {
    const parsed = vehiclesResponseSchema.parse({
      vehicles: [{ ...vehicle, created_by: 'user_1' }],
    });

    expect(parsed.vehicles).toEqual([vehicle]);
  });

  it('refuses an identifier outside the known vocabularies', () => {
    const result = vehiclesResponseSchema.safeParse({
      vehicles: [
        { ...vehicle, identifiers: [{ type: 'ktype', value: '1234' }] },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe('vinLookupResponseSchema', () => {
  it('reads a resolved lookup with the facts the VIN revealed', () => {
    expect(
      vinLookupResponseSchema.parse({
        resolved: true,
        vehicle,
        facts: { steering: 'right' },
      }),
    ).toEqual({ resolved: true, vehicle, facts: { steering: 'right' } });
  });

  it('reads an unresolved lookup with the extracted code', () => {
    expect(
      vinLookupResponseSchema.parse({
        resolved: false,
        make: 'bmw',
        code: '99ZZ',
      }),
    ).toEqual({ resolved: false, make: 'bmw', code: '99ZZ' });
  });

  it('refuses a resolved lookup without a vehicle', () => {
    expect(
      vinLookupResponseSchema.safeParse({ resolved: true, facts: {} }).success,
    ).toBe(false);
  });
});

describe('vinSchema', () => {
  it('reads a VIN typed in any case with spaces around it', () => {
    expect(vinSchema.parse(' wba8e9g50gnu12345 ')).toBe('WBA8E9G50GNU12345');
  });

  it('reads a VIN pasted with spaces, dots or dashes inside', () => {
    expect(vinSchema.parse('WBA 35BG0-70N.074158')).toBe('WBA35BG070N074158');
  });

  it('refuses a VIN with I, O or Q or of the wrong length', () => {
    expect(vinSchema.safeParse('WBA8E9G50GNU1234O').success).toBe(false);
    expect(vinSchema.safeParse('WBA8E9G50GNU1234').success).toBe(false);
  });
});
