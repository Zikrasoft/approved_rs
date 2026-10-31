import { describe, expect, it } from 'vitest';

import {
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  vehicleName,
  vinSchema,
  type Vehicle,
} from './vehicle.ts';

describe('vehicleName', () => {
  const f30 = {
    name: '320d',
    chassis: {
      code: 'F30',
      series: { name: '3 серия', make: { name: 'BMW' } },
    },
  };

  it('names the make, the series, the chassis and the model', () => {
    expect(vehicleName(f30)).toEqual({
      make: 'BMW',
      model: '3 серия F30 320d',
      full: 'BMW 3 серия F30 320d',
    });
  });

  it('takes the series name it is given', () => {
    expect(vehicleName(f30, '3 Series').full).toBe('BMW 3 Series F30 320d');
  });

  it('says a chassis code once when the model name carries it', () => {
    expect(
      vehicleName({
        name: '2.0 d (E83)',
        chassis: { code: 'E83', series: { name: 'X3', make: { name: 'BMW' } } },
      }).full,
    ).toBe('BMW X3 2.0 d (E83)');
    expect(vehicleName({ ...f30, name: 'F30 320d' }).full).toBe(
      'BMW 3 серия F30 320d',
    );
  });

  it('says a series once when the catalogue reused it as the chassis code and the model name repeats it', () => {
    expect(
      vehicleName({
        name: 'MB 200 DKDL',
        chassis: {
          code: 'MB',
          series: { name: 'MB', make: { name: 'DAF BUS (VDL BUS GROUP)' } },
        },
      }).full,
    ).toBe('DAF BUS (VDL BUS GROUP) MB 200 DKDL');
    expect(
      vehicleName({
        name: '1.6 GDI',
        chassis: {
          code: 'Veloster',
          series: { name: 'Veloster', make: { name: 'HYUNDAI' } },
        },
      }).full,
    ).toBe('HYUNDAI Veloster 1.6 GDI');
  });

  it('names what it knows of a model the catalogue left half described', () => {
    expect(vehicleName({ name: '320d' })).toEqual({
      make: '',
      model: '320d',
      full: '320d',
    });
    expect(vehicleName({ name: '320d', chassis: { code: 'F30' } }).full).toBe(
      'F30 320d',
    );
  });
});

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

  it('reads Cyrillic look-alike letters typed on a Russian layout as Latin', () => {
    expect(vinSchema.parse('WВА35ВG070N074158')).toBe('WBA35BG070N074158');
    expect(vinSchema.parse('wва35вg070n074158')).toBe('WBA35BG070N074158');
  });

  it('finds the VIN behind a prefix or among other words', () => {
    expect(vinSchema.parse('VIN WBA35BG070N074158')).toBe('WBA35BG070N074158');
    expect(vinSchema.parse('vin: WBA 35BG 070N074158')).toBe(
      'WBA35BG070N074158',
    );
    expect(vinSchema.parse('WBA35BG070N074158, BMW')).toBe('WBA35BG070N074158');
    expect(vinSchema.parse('WBA35BG070N074158🚗')).toBe('WBA35BG070N074158');
  });

  it('refuses text that only holds a VIN-length run of other words', () => {
    expect(vinSchema.safeParse('HU 816 x, OX 404 D').success).toBe(false);
  });
});
