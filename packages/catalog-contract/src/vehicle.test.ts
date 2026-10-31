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

  it('reads one page of the vehicle list with its count', () => {
    expect(
      vehiclesResponseSchema.parse({
        vehicles: [vehicle],
        count: 3,
        offset: 1,
        limit: 1,
      }),
    ).toEqual({ vehicles: [vehicle], count: 3, offset: 1, limit: 1 });
  });

  it('reads the whole list from a shop that does not page it yet', () => {
    expect(vehiclesResponseSchema.parse({ vehicles: [vehicle] })).toEqual({
      vehicles: [vehicle],
      count: null,
      offset: null,
      limit: null,
    });
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
      place: null,
    });
  });

  const modelPlace = {
    kind: 'model',
    make: { slug: 'bmw', name: 'BMW' },
    model: vehicle.model,
    vehicle: null,
  };

  it('names the nearest place with a page for a resolved VIN', () => {
    expect(
      vinLookupResponseSchema.parse({
        resolved: true,
        vehicle,
        facts: {},
        place: modelPlace,
      }),
    ).toMatchObject({ place: modelPlace });
  });

  it('names the nearest place with a page the candidates of an unresolved VIN share', () => {
    expect(
      vinLookupResponseSchema.parse({
        resolved: false,
        make: 'bmw',
        code: null,
        vehicle_ids: ['veh_1', 'veh_2'],
        place: modelPlace,
      }),
    ).toMatchObject({ place: modelPlace });
  });

  it('reads a place it cannot read as none', () => {
    expect(
      vinLookupResponseSchema.parse({
        resolved: true,
        vehicle,
        facts: {},
        place: { kind: 'trim' },
      }),
    ).toMatchObject({ place: null });
  });

  it('reads an unresolved lookup from a shop that names no candidates yet', () => {
    expect(
      vinLookupResponseSchema.parse({
        resolved: false,
        make: 'bmw',
        code: '99ZZ',
      }),
    ).toEqual({
      resolved: false,
      make: 'bmw',
      code: '99ZZ',
      model_slug: null,
      vehicle_ids: [],
      place: null,
    });
  });

  it('reads an unresolved lookup with the candidate Vehicles and their common Model', () => {
    expect(
      vinLookupResponseSchema.parse({
        resolved: false,
        make: 'mercedes-benz',
        code: '463273',
        model_slug: 'g-63-amg-463',
        vehicle_ids: ['veh_1', 'veh_2'],
      }),
    ).toMatchObject({
      model_slug: 'g-63-amg-463',
      vehicle_ids: ['veh_1', 'veh_2'],
    });
  });

  it('refuses a resolved lookup without a vehicle', () => {
    expect(
      vinLookupResponseSchema.safeParse({ resolved: true, facts: {} }).success,
    ).toBe(false);
  });
});

describe('vinSchema', () => {
  it('parses what vinOf reads and refuses what it does not', () => {
    expect(vinSchema.parse('vin: wва 35вg070n074158')).toBe(
      'WBA35BG070N074158',
    );
    expect(vinSchema.safeParse('HU 816 x, OX 404 D').success).toBe(false);
  });
});
