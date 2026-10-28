import { modelSlugOf, vehicleSlugOf } from '../slug';

describe('modelSlugOf', () => {
  it('reads series, chassis and model', () => {
    expect(
      modelSlugOf({
        make: 'BMW',
        series: '3 Series',
        chassis: 'E90',
        model: '320d',
      }),
    ).toBe('3-series-e90-320d');
  });

  it('drops the make, dates, arrows and a chassis repeated in the model', () => {
    expect(
      modelSlugOf({
        make: 'Mercedes-Benz',
        series: 'MERCEDES-BENZ C-Class',
        chassis: 'W205',
        model: 'C 220 d (W205) 03.2014 → 2021',
      }),
    ).toBe('c-class-w205-c-220-d');
  });

  it('keeps a number that repeats', () => {
    expect(
      modelSlugOf({
        make: 'BMW',
        series: '1',
        chassis: 'E82/E88',
        model: '125i (E82/E88) 1.6',
      }),
    ).toBe('1-e82-e88-125i-1-6');
  });
});

describe('vehicleSlugOf', () => {
  it('reads engine and kW', () => {
    expect(vehicleSlugOf({ engine: 'N52 B30A', power_kw: 160 })).toBe(
      'n52-b30a-160kw',
    );
  });

  it('reads the engine alone without a power', () => {
    expect(vehicleSlugOf({ engine: 'B47D20O0', power_kw: null })).toBe(
      'b47d20o0',
    );
  });
});
