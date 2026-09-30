import { describe, it, expect } from 'vitest';
import { fitmentSchema, parseAttributes, specSchema } from './spec.ts';
import { SERVICE_TYPE, productType, type ProductTypeDef } from './registry.ts';

const batteries = productType('batteries')!;
const oils = productType('motor-oils')!;

const BOSCH = {
  brand: 'Bosch',
  capacityAh: 60,
  crankingA: 540,
  polarity: 'left',
  lengthMm: 242,
  widthMm: 175,
  heightMm: 175,
  warrantyMonths: 24,
};

const GOLF = {
  make: 'Volkswagen',
  model: 'Golf',
  yearFrom: 2012,
  yearTo: 2019,
};

const bare: ProductTypeDef = {
  key: 'bare',
  label: 'Bare',
  fitment: 'optional',
  fields: [
    { kind: 'boolean', key: 'sealed', label: 'Sealed' },
    { kind: 'number', key: 'weight', label: 'Weight', unit: 'mm' },
  ],
};

describe('specSchema', () => {
  it('accepts a complete battery spec', () => {
    expect(specSchema(batteries).parse(BOSCH)).toEqual(BOSCH);
  });

  it('accepts an optional field when it is valid and when it is absent', () => {
    expect(
      specSchema(batteries).safeParse({ ...BOSCH, technology: 'agm' }).success,
    ).toBe(true);
    expect(specSchema(batteries).safeParse(BOSCH).success).toBe(true);
  });

  it.each([
    ['an unknown key', { ...BOSCH, voltage: 12 }],
    ['a missing required field', { ...BOSCH, capacityAh: undefined }],
    ['a fractional integer field', { ...BOSCH, capacityAh: 60.5 }],
    ['a value above the maximum', { ...BOSCH, capacityAh: 401 }],
    ['a value below the minimum', { ...BOSCH, crankingA: 0 }],
    ['an enum value outside the list', { ...BOSCH, polarity: 'up' }],
    ['a blank code', { ...BOSCH, brand: '   ' }],
    ['an invalid optional value', { ...BOSCH, technology: 'gel' }],
  ])('rejects %s', (_label, spec) => {
    expect(specSchema(batteries).safeParse(spec).success).toBe(false);
  });

  it('takes several codes where the field allows several', () => {
    const oil = {
      brand: 'Motul',
      viscosity: '5w-30',
      volumeL: 4,
      base: 'synthetic',
      approvals: ['VW 504.00', 'ACEA C3'],
    };
    expect(specSchema(oils).safeParse(oil).success).toBe(true);
    expect(specSchema(oils).safeParse({ ...oil, approvals: [] }).success).toBe(
      false,
    );
    expect(
      specSchema(oils).safeParse({ ...oil, approvals: [''] }).success,
    ).toBe(false);
    expect(specSchema(oils).safeParse({ ...oil, volumeL: 0.5 }).success).toBe(
      true,
    );
  });

  it('builds booleans and unbounded numbers', () => {
    const schema = specSchema(bare);
    expect(schema.safeParse({ sealed: true, weight: -3.5 }).success).toBe(true);
    expect(schema.safeParse({ sealed: 'yes' }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('fitmentSchema', () => {
  it('accepts a year range and rejects an inverted one', () => {
    expect(fitmentSchema.safeParse([GOLF]).success).toBe(true);
    expect(
      fitmentSchema.safeParse([{ ...GOLF, yearFrom: 2020, yearTo: 2010 }])
        .success,
    ).toBe(false);
  });

  it('rejects blank names, stray keys and impossible years', () => {
    expect(fitmentSchema.safeParse([{ ...GOLF, make: ' ' }]).success).toBe(
      false,
    );
    expect(fitmentSchema.safeParse([{ ...GOLF, trim: 'GTI' }]).success).toBe(
      false,
    );
    expect(fitmentSchema.safeParse([{ ...GOLF, yearFrom: 1900 }]).success).toBe(
      false,
    );
  });
});

describe('parseAttributes', () => {
  it('returns the type, spec and fitment of a valid product', () => {
    const result = parseAttributes('batteries', {
      spec: BOSCH,
      fitment: [GOLF],
      translated_from: 'abc',
    });
    expect(result).toEqual({
      ok: true,
      type: batteries,
      spec: BOSCH,
      fitment: [GOLF],
    });
  });

  it('defaults missing fitment to none', () => {
    const result = parseAttributes('batteries', { spec: BOSCH });
    expect(result.ok && result.fitment).toEqual([]);
  });

  it.each([null, undefined, '', 'unknown', SERVICE_TYPE])(
    'refuses the type %j',
    (key) => {
      const result = parseAttributes(key, { spec: BOSCH });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toMatch(/unknown product type/);
    },
  );

  it('refuses metadata that is not an object', () => {
    expect(parseAttributes('batteries', 'spec').ok).toBe(false);
  });

  it('refuses a missing spec, naming the first bad field instead of throwing', () => {
    const result = parseAttributes('batteries', null);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/brand/);
  });

  it('refuses a spec saved under an older registry shape without throwing', () => {
    const result = parseAttributes('batteries', {
      spec: { ...BOSCH, ampHours: 60 },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/ampHours/);
  });

  it('refuses malformed fitment', () => {
    const result = parseAttributes('batteries', {
      spec: BOSCH,
      fitment: [{ ...GOLF, yearTo: 2000 }],
    });
    expect(result.ok).toBe(false);
  });

  it('demands fitment where the type requires it', () => {
    const result = parseAttributes('filters', {
      spec: { brand: 'Mann', filterKind: 'oil' },
    });
    expect(result).toEqual({ ok: false, error: 'filters requires fitment' });
  });

  it('refuses fitment where the type takes none', () => {
    const result = parseAttributes('motor-oils', {
      spec: {
        brand: 'Motul',
        viscosity: '5w-30',
        volumeL: 4,
        base: 'synthetic',
      },
      fitment: [GOLF],
    });
    expect(result).toEqual({ ok: false, error: 'motor-oils takes no fitment' });
  });
});
