import { describe, it, expect } from 'vitest';
import {
  buildFitmentIndex,
  fitmentMatches,
  type FitmentEntry,
} from './fitment.ts';

const FITMENT: FitmentEntry[] = [
  { make: 'Volkswagen', model: 'Golf', yearFrom: 2012, yearTo: 2019 },
  { make: 'Škoda', model: 'Octavia', yearFrom: 2013, yearTo: 2020 },
];

describe('fitmentMatches', () => {
  it('matches everything when no filter is set', () => {
    expect(fitmentMatches(FITMENT, {})).toBe(true);
  });

  it('matches on make alone', () => {
    expect(fitmentMatches(FITMENT, { make: 'Volkswagen' })).toBe(true);
    expect(fitmentMatches(FITMENT, { make: 'BMW' })).toBe(false);
  });

  it('requires make and model to belong to the same entry', () => {
    expect(
      fitmentMatches(FITMENT, { make: 'Volkswagen', model: 'Octavia' }),
    ).toBe(false);
  });

  it('includes both boundary years', () => {
    const filter = { make: 'Volkswagen', model: 'Golf' };
    expect(fitmentMatches(FITMENT, { ...filter, year: 2012 })).toBe(true);
    expect(fitmentMatches(FITMENT, { ...filter, year: 2019 })).toBe(true);
  });

  it('excludes a year outside the range', () => {
    const filter = { make: 'Volkswagen', model: 'Golf' };
    expect(fitmentMatches(FITMENT, { ...filter, year: 2011 })).toBe(false);
    expect(fitmentMatches(FITMENT, { ...filter, year: 2020 })).toBe(false);
  });

  it('never matches a product with no fitment data when a filter is set', () => {
    expect(fitmentMatches([], { make: 'Volkswagen' })).toBe(false);
  });

  it('never matches an inverted year range', () => {
    const inverted: FitmentEntry[] = [
      { make: 'BMW', model: 'X5', yearFrom: 2020, yearTo: 2010 },
    ];
    expect(fitmentMatches(inverted, { make: 'BMW', year: 2015 })).toBe(false);
  });
});

describe('buildFitmentIndex', () => {
  it('collects makes, models and years without duplicates', () => {
    const index = buildFitmentIndex([
      FITMENT,
      [{ make: 'Volkswagen', model: 'Golf', yearFrom: 2015, yearTo: 2021 }],
    ]);
    expect(index.makes).toEqual(['Škoda', 'Volkswagen']);
    expect(index.modelsByMake.Volkswagen).toEqual(['Golf']);
    const years = index.yearsByModel['Volkswagen|Golf'];
    expect(years[0]).toBe(2021);
    expect(years.at(-1)).toBe(2012);
    expect(new Set(years).size).toBe(years.length);
  });

  it('sorts with the collator it is given', () => {
    const index = buildFitmentIndex(
      [
        [
          { make: 'b', model: 'x', yearFrom: 2020, yearTo: 2020 },
          { make: 'A', model: 'y', yearFrom: 2020, yearTo: 2020 },
        ],
      ],
      new Intl.Collator('en', { caseFirst: 'upper' }),
    );
    expect(index.makes).toEqual(['A', 'b']);
  });

  it('keeps an inverted range as a model with no years', () => {
    const index = buildFitmentIndex([
      [{ make: 'BMW', model: 'X5', yearFrom: 2020, yearTo: 2010 }],
    ]);
    expect(index.yearsByModel['BMW|X5']).toEqual([]);
  });

  it('returns an empty index for no data', () => {
    expect(buildFitmentIndex([[]])).toEqual({
      makes: [],
      modelsByMake: {},
      yearsByModel: {},
    });
  });
});
