import rows from '../vag-model-codes.json';
import {
  vagMakesOf,
  vagModelCodeSchema,
  vagModelCodes,
  vagReference,
} from '../vag-model-codes';

const ROW = {
  make: 'volkswagen',
  code: 'AU',
  model: 'Golf',
  generation: 'Golf VII',
  types: ['AU', '5G'],
  from: 2012,
  to: 2020,
  market: 'all',
  sources: ['https://example.org/golf'],
};

describe('the bundled VAG model code table', () => {
  it('parses every row and records where each one comes from', () => {
    const parsed = rows.map((row) => vagModelCodeSchema.parse(row));

    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.every(({ sources }) => sources.length > 0)).toBe(true);
  });

  it('holds each code once per make, generation and market', () => {
    const keys = rows.map(
      ({ make, code, generation, market }) =>
        `${make}|${code}|${generation}|${market}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each([
    ['a three-character code', { code: 'AU1' }],
    ['a lower-case code', { code: 'au' }],
    ['a make outside the group', { make: 'porsche' }],
    ['no type', { types: [] }],
    ['a type of four characters', { types: ['5G1X'] }],
    ['years that run backwards', { from: 2020, to: 2012 }],
    ['no source', { sources: [] }],
    ['a source that is no URL', { sources: ['Wikipedia'] }],
    ['an unknown field', { note: 'guess' }],
  ])('refuses a row with %s', (_, change) => {
    expect(vagModelCodeSchema.safeParse({ ...ROW, ...change }).success).toBe(
      false,
    );
  });

  it('accepts a row whose years are open', () => {
    expect(
      vagModelCodeSchema.safeParse({ ...ROW, from: null, to: null }).success,
    ).toBe(true);
  });
});

describe('vagMakesOf', () => {
  it.each([
    ['WVW', ['volkswagen']],
    ['WVG', ['volkswagen']],
    ['WV2', ['volkswagen']],
    ['WAU', ['audi']],
    ['TRU', ['audi']],
    ['TMB', ['skoda']],
    ['VSS', ['seat', 'cupra']],
  ])('names the makes WMI %s stands for', (wmi, makes) => {
    expect(vagMakesOf(wmi)).toEqual(makes);
  });

  it('names none for a WMI outside the group', () => {
    expect(vagMakesOf('WBA')).toEqual([]);
  });
});

describe('vagModelCodes', () => {
  it('finds the generations a code stands for within its make', () => {
    expect(
      vagModelCodes('volkswagen', 'AU').map(({ generation }) => generation),
    ).toContain('Golf VII');
    expect(vagModelCodes('audi', 'AU')).toEqual([]);
  });

  it('reads a SEAT code for Cupra too, since both share one WMI', () => {
    expect(vagModelCodes('cupra', 'KM')).toEqual(vagModelCodes('seat', 'KM'));
    expect(vagModelCodes('seat', 'KM').map(({ make }) => make)).toContain(
      'cupra',
    );
  });

  it('finds nothing for an unknown code or a make outside the group', () => {
    expect(vagModelCodes('volkswagen', '00')).toEqual([]);
    expect(vagModelCodes('bmw', 'AU')).toEqual([]);
  });
});

describe('vagReference', () => {
  it('sums up what the open data says a code is', () => {
    expect(vagReference('skoda', 'NX')).toEqual({
      code: 'NX',
      chassis: expect.stringContaining('NX'),
      model: expect.stringContaining('Octavia'),
      from: expect.any(String),
      to: null,
    });
  });

  it('names every generation a shared code stands for', () => {
    const generations = vagModelCodes('volkswagen', '1K').map(
      ({ generation }) => generation,
    );

    expect(generations.length).toBeGreaterThan(1);
    expect(vagReference('volkswagen', '1K')?.model).toBe(
      [...new Set(generations)].join(' / '),
    );
  });

  it('has nothing to say about a code the open data lacks', () => {
    expect(vagReference('volkswagen', '00')).toBeNull();
  });
});
