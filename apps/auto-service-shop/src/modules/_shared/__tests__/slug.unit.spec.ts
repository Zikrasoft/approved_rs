import { modelSlugOf, slugOf, vehicleSlugOf } from '../slug';

describe('slugOf', () => {
  it.each([
    ['Đurđevac', 'djurdjevac'],
    ['ĐURĐEVAC', 'djurdjevac'],
    ['Ölfilter für Straße', 'olfilter-fur-strasse'],
    ['Łódź', 'lodz'],
    ['Søren Ørsted', 'soren-orsted'],
    ['Ærø', 'aero'],
    ['Œuvre cœur', 'oeuvre-coeur'],
    ['Kočnice i vešanje', 'kocnice-i-vesanje'],
    ['Citroën C4', 'citroen-c4'],
  ])('slugs %j as %j', (name, slug) => {
    expect(slugOf(name)).toBe(slug);
  });
});

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

  it('keeps a series word the make also uses', () => {
    expect(
      modelSlugOf({
        make: 'Land Rover',
        series: 'Range Rover',
        chassis: 'L322',
        model: 'LAND ROVER 4.4 V8 (L322)',
      }),
    ).toBe('range-rover-l322-4-4-v8');
  });

  it('drops the codes a crawled model lists in parentheses, which its chassis already names', () => {
    expect(
      modelSlugOf({
        make: 'BMW',
        series: '6',
        chassis: 'E63/E64',
        model: '645 Ci (E63/64)',
      }),
    ).toBe('6-e63-e64-645-ci');
    expect(
      modelSlugOf({
        make: 'Mercedes-Benz',
        series: 'C-Class',
        chassis: '205',
        model: 'C 220 d / BlueTEC (205)',
      }),
    ).toBe('c-class-205-c-220-d-bluetec');
    expect(
      modelSlugOf({
        make: 'Volkswagen',
        series: 'Transporter/Bus',
        chassis: '24/25',
        model: '1.6 TD (24,25)',
      }),
    ).toBe('transporter-bus-24-25-1-6-td');
    expect(
      modelSlugOf({
        make: 'BMW',
        series: '4',
        chassis: 'F32/F82',
        model: 'M4 (F32/F82) ( M4 CS)',
      }),
    ).toBe('4-f32-f82-m4-cs');
  });

  it('names a chassis once when a site gives the series as its code', () => {
    expect(
      modelSlugOf({
        make: 'Opel',
        series: 'Kadett-C',
        chassis: 'Kadett-C',
        model: '1.2',
      }),
    ).toBe('kadett-c-1-2');
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
    expect(
      vehicleSlugOf({ engine: 'N52 B30A', variant: '330i', power_kw: 160 }),
    ).toBe('n52-b30a-160kw');
  });

  it('reads the engine alone without a power', () => {
    expect(
      vehicleSlugOf({ engine: 'B47D20O0', variant: '320d', power_kw: null }),
    ).toBe('b47d20o0');
  });

  it('reads the variant and kW of a Vehicle without an engine', () => {
    expect(
      vehicleSlugOf({
        engine: null,
        variant: '320 d (E90/E91)',
        power_kw: 120,
      }),
    ).toBe('320-d-120kw');
  });

  it('reads the variant alone without an engine or a power', () => {
    expect(
      vehicleSlugOf({ engine: null, variant: '320d', power_kw: null }),
    ).toBe('320d');
  });
});
