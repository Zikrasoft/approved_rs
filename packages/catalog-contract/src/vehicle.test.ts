import { describe, expect, it } from 'vitest';

import {
  carHitSchema,
  generationOf,
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  vehicleLabel,
  vehicleName,
  VIN_REFUSAL,
  vinSchema,
  type Vehicle,
} from './vehicle.ts';

describe('vehicleLabel', () => {
  it('names the car with its engine code', () => {
    expect(
      vehicleLabel({
        model: {
          name: '320d',
          chassis: {
            code: 'F30',
            series: { name: '3 серия', make: { name: 'BMW' } },
          },
        },
        engine: { code: 'N47D20' },
      }),
    ).toBe('BMW 3 серия F30 320d, N47D20');
  });

  it('names a car without an engine by its model alone', () => {
    expect(
      vehicleLabel({
        model: {
          name: '320d',
          chassis: {
            code: 'F30',
            series: { name: '3 серия', make: { name: 'BMW' } },
          },
        },
        engine: null,
      }),
    ).toBe('BMW 3 серия F30 320d');
  });
});

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
        translations: { sr: { name: 'Serija 3' }, en: { name: '3 Series' } },
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
    ).toEqual({
      vehicles: [vehicle],
      count: 3,
      offset: 1,
      limit: 1,
      next: null,
    });
  });

  it('reads a page that names the next cursor', () => {
    expect(
      vehiclesResponseSchema.parse({
        vehicles: [vehicle],
        limit: 1,
        next: 'veh_1',
      }),
    ).toMatchObject({ count: null, offset: null, next: 'veh_1' });
  });

  it('reads the whole list from a shop that does not page it yet', () => {
    expect(vehiclesResponseSchema.parse({ vehicles: [vehicle] })).toEqual({
      vehicles: [vehicle],
      count: null,
      offset: null,
      limit: null,
      next: null,
    });
  });

  it.each([
    ['pickup', 'lpg'],
    ['minivan', 'cng'],
    ['crossover', 'plug-in-hybrid'],
    ['van', 'mild-hybrid'],
  ])('reads a %s body and %s fuel', (body_style, fuel) => {
    const parsed = vehiclesResponseSchema.parse({
      vehicles: [
        {
          ...vehicle,
          model: {
            ...vehicle.model,
            chassis: { ...vehicle.model.chassis, body_style },
          },
          engine: { ...vehicle.engine, fuel },
        },
      ],
    });

    expect(parsed.vehicles[0]).toMatchObject({
      model: { chassis: { body_style } },
      engine: { fuel },
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
    const { fuel: _fuel, ...engine } = vehicle.engine!;
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

describe('a Vehicle without an engine', () => {
  it('reads a Vehicle the shop knows only down to its model', () => {
    expect(
      vehiclesResponseSchema.parse({ vehicles: [{ ...vehicle, engine: null }] })
        .vehicles[0].engine,
    ).toBeNull();
  });

  it('reads a car search hit without an engine', () => {
    expect(
      carHitSchema.parse({
        kind: 'vehicle',
        make: { slug: 'bmw', name: 'BMW' },
        model: vehicle.model,
        vehicle: {
          id: 'veh_1',
          slug: '320d-140kw',
          power_kw: 140,
          year_from: 2015,
          year_to: 2019,
          engine: null,
        },
      }).vehicle?.engine,
    ).toBeNull();
  });

  it('reads a car search hit from a shop that predates Series as naming none', () => {
    expect(
      carHitSchema.parse({
        kind: 'make',
        make: { slug: 'bmw', name: 'BMW' },
        model: null,
        vehicle: null,
      }).series,
    ).toBeNull();
  });
});

describe('series translations', () => {
  const series = (translations: unknown) =>
    vehiclesResponseSchema.parse({
      vehicles: [
        {
          ...vehicle,
          model: {
            ...vehicle.model,
            chassis: {
              ...vehicle.model.chassis,
              series: { ...vehicle.model.chassis.series, translations },
            },
          },
        },
      ],
    }).vehicles[0].model.chassis.series.translations;

  it('reads the per-column translations every other entity carries', () => {
    expect(series({ sr: { name: 'Serija 3' } })).toEqual({
      sr: { name: 'Serija 3' },
    });
  });

  it('reads the flat translations an older shop sends as the name column', () => {
    expect(series({ sr: 'Serija 3', en: '3 Series' })).toEqual({
      sr: { name: 'Serija 3' },
      en: { name: '3 Series' },
    });
  });

  it('reads translations it cannot read as none', () => {
    expect(series({ sr: 7 })).toBeNull();
  });
});

describe('generationOf', () => {
  const engineLess = (id: string, fields: Partial<Vehicle> = {}): Vehicle => ({
    ...vehicle,
    id,
    engine: null,
    ...fields,
  });
  const otherModel = {
    ...vehicle.model,
    slug: 'f31-320d',
  };

  it('finds the Vehicles without an engine of the same model that a car shares its years and power with', () => {
    const fits = engineLess('veh_gen');
    expect(
      generationOf(vehicle, [
        vehicle,
        fits,
        engineLess('veh_open', {
          power_kw: null,
          year_from: null,
          year_to: null,
        }),
        engineLess('veh_weaker', { power_kw: 100 }),
        engineLess('veh_older', { year_from: 2005, year_to: 2011 }),
        engineLess('veh_touring', { model: otherModel }),
        engineLess('veh_other_make', {
          model: {
            ...vehicle.model,
            chassis: {
              ...vehicle.model.chassis,
              series: {
                ...vehicle.model.chassis.series,
                make: { slug: 'mini', name: 'MINI' },
              },
            },
          },
        }),
      ]).map(({ id }) => id),
    ).toEqual(['veh_gen', 'veh_open']);
  });

  it('gives a Vehicle without an engine no generation of its own', () => {
    expect(
      generationOf(engineLess('veh_gen'), [engineLess('veh_other')]),
    ).toEqual([]);
  });

  it('reads an open year range as overlapping', () => {
    expect(
      generationOf({ ...vehicle, year_from: null, year_to: null }, [
        engineLess('veh_gen'),
      ]),
    ).toHaveLength(1);
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
    kind: 'series',
    make: { slug: 'bmw', name: 'BMW' },
    series: { name: '3 Series', translations: null },
    model: null,
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

  it.each(['ЖЖЖ123', '12345678901234567', 'WBA35BG07ON07415', ' '])(
    'refuses %j with a message that says what a VIN is, not what was typed',
    (text) => {
      expect(vinSchema.safeParse(text).error?.issues).toEqual([
        expect.objectContaining({ message: VIN_REFUSAL }),
      ]);
    },
  );
});
