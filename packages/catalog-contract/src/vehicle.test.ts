import { describe, expect, it } from 'vitest';

import {
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  vinSchema,
  type Vehicle,
} from './vehicle.ts';

const vehicle: Vehicle = {
  id: 'veh_1',
  slug: 'b47d20o0-140kw',
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

  it('reads a vocabulary value newer than the contract as null', () => {
    const parsed = vehiclesResponseSchema.parse({
      vehicles: [
        {
          ...vehicle,
          drive: 'four-wheel',
          steering: 'centre',
          identifiers: [{ type: 'ktype', value: '1234' }],
          model: {
            ...vehicle.model,
            chassis: { ...vehicle.model.chassis, body_style: 'shooting-brake' },
          },
          engine: { ...vehicle.engine, fuel: 'hydrogen' },
        },
      ],
    });

    expect(parsed.vehicles[0]).toMatchObject({
      drive: null,
      steering: null,
      identifiers: [{ type: null, value: '1234' }],
      model: { chassis: { body_style: null } },
      engine: { fuel: null },
    });
  });

  it('reads a vehicle from a shop that has not shipped its slug, fuel and body style', () => {
    const { slug: _slug, ...unslugged } = vehicle;
    const { fuel: _fuel, ...engine } = vehicle.engine;
    const { body_style: _body, ...chassis } = vehicle.model.chassis;

    const parsed = vehiclesResponseSchema.parse({
      vehicles: [
        { ...unslugged, engine, model: { ...vehicle.model, chassis } },
      ],
    });

    expect(parsed.vehicles[0]).toMatchObject({
      slug: null,
      engine: { fuel: null },
      model: { chassis: { body_style: null } },
    });
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
    ).toEqual({
      resolved: true,
      vehicle,
      facts: { steering: 'right' },
      pages: null,
    });
  });

  it("names which of the car's places have a page", () => {
    const pages = { vehicle: false, model: true, make: true };
    expect(
      vinLookupResponseSchema.parse({
        resolved: true,
        vehicle,
        facts: {},
        pages,
      }),
    ).toMatchObject({ pages });
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
