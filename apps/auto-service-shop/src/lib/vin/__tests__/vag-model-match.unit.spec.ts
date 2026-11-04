import { type Vehicle, vehicleSchema } from '@podbor/catalog-contract';

import type { VagModelCode } from '../vag-model-codes';
import { vagModelCodeMatches } from '../vag-model-match';

const row = (fields: Partial<VagModelCode>): VagModelCode => ({
  make: 'volkswagen',
  code: 'AU',
  model: 'Golf',
  generation: 'Golf VII',
  types: ['AU', '5G', 'BA', 'BQ'],
  from: 2012,
  to: 2020,
  market: 'all',
  sources: ['https://example.org/golf'],
  ...fields,
});

const GOLF_VII = row({});
const GOLF_V = row({
  code: '1K',
  generation: 'Golf V',
  types: ['1K', '5M'],
  from: 2003,
  to: 2009,
});
const GOLF_VI = row({
  code: '1K',
  generation: 'Golf VI',
  types: ['1K', '5K', 'AJ'],
  from: 2008,
  to: 2013,
});
const FORMENTOR = row({
  make: 'cupra',
  code: 'KM',
  model: 'Formentor',
  generation: 'Formentor',
  types: ['KM'],
  from: 2020,
  to: null,
});

let ids = 0;

const crawled = ({
  make = 'volkswagen',
  chassis,
  name = '2.0 TDI 16V',
  years = [2012, 2020],
}: {
  make?: string;
  chassis: string;
  name?: string;
  years?: [number | null, number | null];
}): Vehicle =>
  vehicleSchema.parse({
    id: `veh_${(ids += 1)}`,
    power_kw: 110,
    drive: null,
    market: null,
    year_from: years[0],
    year_to: years[1],
    steering: null,
    model: {
      slug: `model-${ids}`,
      name,
      chassis: {
        code: chassis,
        body_style: null,
        series: {
          name: 'Golf',
          translations: null,
          make: { slug: make, name: make },
        },
      },
    },
    engine: {
      code: 'CRBC',
      family: 'EA288',
      fuel: 'diesel',
      displacement_cc: 1968,
    },
    identifiers: [],
    requirements: [],
  });

const MY_2017 = [1987, 2017, 2047];
const MY_2005 = [1975, 2005, 2035];

describe('vagModelCodeMatches', () => {
  it('keeps the Vehicles whose Chassis carries a type the code stands for', () => {
    const typed = crawled({ chassis: '5G1/BA5' });
    const coded = crawled({ chassis: 'AU1/AU2' });
    const sportsvan = crawled({ chassis: 'AM1' });
    const golfV = crawled({ chassis: '1K1/1K5/5M1/AJ5' });
    const untyped = crawled({ chassis: 'Golf VIII' });

    expect(
      vagModelCodeMatches([GOLF_VII], MY_2017, [
        typed,
        coded,
        sportsvan,
        golfV,
        untyped,
      ]),
    ).toEqual([typed, coded]);
  });

  it('reads the type off a Chassis code however the crawl joined it', () => {
    const spaced = crawled({ chassis: 'bq1, ba5' });
    const prefixed = crawled({ chassis: 'Golf VII 5G' });

    expect(
      vagModelCodeMatches([GOLF_VII], MY_2017, [spaced, prefixed]),
    ).toEqual([spaced, prefixed]);
  });

  it('tells two models of one type apart by a three-character type', () => {
    const q8Row = row({
      make: 'audi',
      code: 'F1',
      model: 'Q8',
      generation: 'Q8',
      types: ['4MN'],
      from: 2018,
      to: null,
    });
    const q8 = crawled({ make: 'audi', chassis: '4MN', years: [2018, null] });
    const q7 = crawled({
      make: 'audi',
      chassis: '4MB/4MG',
      years: [2015, null],
    });

    expect(vagModelCodeMatches([q8Row], [1990, 2020, 2050], [q8, q7])).toEqual([
      q8,
    ]);
  });

  it('keeps only Vehicles of the make the code belongs to', () => {
    const audi = crawled({ make: 'audi', chassis: '5G1' });

    expect(vagModelCodeMatches([GOLF_VII], MY_2017, [audi])).toEqual([]);
  });

  it('reads a shared code through the generation the model year falls in', () => {
    const golfV = crawled({ chassis: '1K1/1K5', years: [2003, 2009] });
    const golfVI = crawled({ chassis: '5K1', years: [2008, 2013] });

    expect(
      vagModelCodeMatches([GOLF_V, GOLF_VI], MY_2005, [golfV, golfVI]),
    ).toEqual([golfV]);
  });

  it('drops a Vehicle built more than a year away from the model year', () => {
    const early = crawled({ chassis: '5G1', years: [2012, 2015] });
    const late = crawled({ chassis: '5G1', years: [2018, null] });
    const lastYear = crawled({ chassis: '5G1', years: [2014, 2016] });
    const undated = crawled({ chassis: '5G1', years: [null, null] });

    expect(
      vagModelCodeMatches([GOLF_VII], MY_2017, [
        early,
        late,
        lastYear,
        undated,
      ]),
    ).toEqual([late, lastYear, undated]);
  });

  it('matches nothing when the model year falls outside every generation', () => {
    expect(
      vagModelCodeMatches([GOLF_VII], MY_2005, [crawled({ chassis: '5G1' })]),
    ).toEqual([]);
  });

  it('matches on the type alone when the VIN carries no model year', () => {
    const golf = crawled({ chassis: '5G1', years: [2012, 2013] });

    expect(vagModelCodeMatches([GOLF_VII], [], [golf])).toEqual([golf]);
  });

  it('matches a Cupra code to the Cupra Vehicles only', () => {
    const cupra = crawled({
      make: 'cupra',
      chassis: 'KM7',
      years: [2020, null],
    });
    const seat = crawled({ make: 'seat', chassis: 'KM7', years: [2020, null] });

    expect(
      vagModelCodeMatches([FORMENTOR], [1991, 2021, 2051], [cupra, seat]),
    ).toEqual([cupra]);
  });

  it('matches nothing without a row', () => {
    expect(
      vagModelCodeMatches([], MY_2017, [crawled({ chassis: '5G1' })]),
    ).toEqual([]);
  });
});
