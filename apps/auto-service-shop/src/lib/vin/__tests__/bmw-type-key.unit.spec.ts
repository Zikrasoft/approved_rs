import { type Vehicle, vehicleSchema } from '@podbor/catalog-contract';

import { type TypeKey, typeKey, typeKeyDescribes } from '../bmw-type-key';

type Facts = {
  name?: string;
  chassis?: string;
  family?: string;
  cc?: number;
  kw?: number;
  drive?: string | null;
  steering?: string | null;
  years?: [number | null, number | null];
};

const crawled = ({
  name = '320 d (F30, F31) Gearbox code: ZF 8HP45Z/50Z Automatic gearbox',
  chassis = 'F30/F31',
  family = 'B47',
  cc = 1995,
  kw = 140,
  drive = null,
  steering = null,
  years = [2015, null],
}: Facts = {}): Vehicle =>
  vehicleSchema.parse({
    id: 'veh_1',
    power_kw: kw,
    drive,
    market: null,
    year_from: years[0],
    year_to: years[1],
    steering,
    model: {
      slug: 'model',
      name,
      chassis: {
        code: chassis,
        body_style: null,
        series: {
          name: '3',
          translations: null,
          make: { slug: 'bmw', name: 'BMW' },
        },
      },
    },
    engine: {
      code: `${family}D20A`,
      family,
      fuel: 'diesel',
      displacement_cc: cc,
    },
    identifiers: [],
    requirements: [],
  });

const key = (code: string): TypeKey => {
  const found = typeKey(code);
  if (!found) throw new Error(`no type key ${code}`);
  return found;
};

describe('typeKeyDescribes', () => {
  it('reads the open-data row of a type code', () => {
    expect(key('8C51')).toEqual({
      code: '8C51',
      chassis: 'F30',
      model: '320d',
      body: 'Sedan',
      engine: 'B47D20O0',
      power_kw: 140,
      drivetrain: 'rwd',
      steering: 'left',
      from: null,
      to: null,
    });
  });

  it('accepts a crawled Vehicle whose chassis, engine family and power agree', () => {
    expect(typeKeyDescribes(key('8C51'), crawled())).toBe(true);
  });

  it.each<[string, Facts]>([
    ['another chassis', { chassis: 'F32/F33/F36' }],
    ['another engine family', { family: 'N47' }],
    ['another power', { kw: 135 }],
    ['another model designation', { name: '318 d (F30, F31)' }],
    ['a body its name gives', { name: '320d Touring (F30/F31)' }],
    ['all-wheel drive its name gives', { name: '320d xDrive (F30, F31)' }],
    ['a drive of its own', { drive: 'awd' }],
    ['the other steering side', { steering: 'right' }],
  ])('rejects a crawled Vehicle with %s', (_, facts) => {
    expect(typeKeyDescribes(key('8C51'), crawled(facts))).toBe(false);
  });

  it('rejects an engine whose displacement the type key contradicts', () => {
    const facts = { name: '523i (F10/F11)', chassis: 'F10/F11', family: 'N52' };

    expect(
      typeKeyDescribes(key('FP15'), crawled({ ...facts, kw: 150, cc: 2996 })),
    ).toBe(false);
    expect(
      typeKeyDescribes(key('FP15'), crawled({ ...facts, kw: 150, cc: 2497 })),
    ).toBe(true);
  });

  it('rejects a Vehicle built outside the production years of the type key', () => {
    const facts = {
      name: '320d (E90/E91)',
      chassis: 'E90/E91',
      family: 'N47',
      kw: 130,
    };

    expect(
      typeKeyDescribes(key('VG91'), crawled({ ...facts, years: [2010, 2012] })),
    ).toBe(false);
    expect(
      typeKeyDescribes(key('VG91'), crawled({ ...facts, years: [2005, 2011] })),
    ).toBe(true);
  });

  it('leaves a code the open data does not list unknown', () => {
    expect(typeKey('35BG')).toBeUndefined();
  });
});
