import { EMPTY_ROW, readFitment, unfinishedRow } from '../fitment-form';

const GOLF = {
  make: 'Volkswagen',
  model: 'Golf',
  yearFrom: 2012,
  yearTo: 2020,
};

describe('unfinishedRow', () => {
  it('accepts a complete row', () => {
    expect(unfinishedRow([GOLF])).toBe(-1);
  });

  it('points at the first row missing a make or a model', () => {
    expect(unfinishedRow([GOLF, { ...GOLF, make: ' ' }])).toBe(1);
    expect(unfinishedRow([{ ...GOLF, model: '' }])).toBe(0);
  });

  it('points at a row with no years, years out of range or years reversed', () => {
    expect(unfinishedRow([EMPTY_ROW])).toBe(0);
    expect(unfinishedRow([{ ...GOLF, yearFrom: 1200 }])).toBe(0);
    expect(unfinishedRow([{ ...GOLF, yearFrom: 2020, yearTo: 2012 }])).toBe(0);
  });
});

describe('readFitment', () => {
  it('trims what it reads back', () => {
    expect(readFitment([{ ...GOLF, make: '  Volkswagen ' }])).toEqual([GOLF]);
  });

  it('reads missing or unusable metadata as no cars', () => {
    expect(readFitment(undefined)).toEqual([]);
    expect(readFitment([{ make: 'Volkswagen' }])).toEqual([]);
  });
});
