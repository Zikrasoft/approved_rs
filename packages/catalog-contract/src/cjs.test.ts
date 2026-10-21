import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('CommonJS build', () => {
  it('resolves require() to dist/cjs', () => {
    expect(require.resolve('@podbor/catalog-contract')).toMatch(
      /dist\/cjs\/index\.js$/,
    );
  });

  it('serves the part number helpers and the page schema to require()', () => {
    const contract = require('@podbor/catalog-contract');
    expect(contract.normalizePartNumber('hu 816 x')).toBe('HU816X');
    expect(contract.PART_IDENTIFIER_TYPES).toContain('oem');
    expect(
      contract.partPagesResponseSchema.safeParse({
        pages: [],
        count: 0,
        offset: 0,
        limit: 1,
      }).success,
    ).toBe(true);
  });

  it('serves the attributes module to require()', () => {
    const contract = require('@podbor/catalog-contract');
    expect(
      contract.matchesRequirements({ approvals: ['bmw-ll-04'] }, [
        { field_key: 'approvals', option_keys: ['bmw-ll-04'] },
      ]),
    ).toBe(true);
  });

  it('serves the ambiguity rule to require()', () => {
    const contract = require('@podbor/catalog-contract');
    expect(
      contract.positionGroups(
        [
          {
            part_id: 'part_1',
            category_id: null,
            axle: 'front',
            side: null,
            steering: null,
            note: null,
          },
        ],
        {},
      )[0].ambiguous,
    ).toBe(false);
  });

  it('serves the zod-free ambiguity subpath to require()', () => {
    expect(require.resolve('@podbor/catalog-contract/ambiguity')).toMatch(
      /dist\/cjs\/ambiguity\.js$/,
    );
    expect(
      require('@podbor/catalog-contract/ambiguity').positionGroups([], {}),
    ).toEqual([]);
  });

  it('serves the zod-free steering subpath to require()', () => {
    expect(require.resolve('@podbor/catalog-contract/steering')).toMatch(
      /dist\/cjs\/steering\.js$/,
    );
    expect(require('@podbor/catalog-contract/steering').STEERING_SIDES).toEqual(
      ['left', 'right'],
    );
  });

  it('serves the zod-free cart fingerprint subpath to require()', () => {
    expect(
      require('@podbor/catalog-contract/fingerprint').cartFingerprint([
        { id: 'item_1', quantity: 2, unit_price: 50 },
      ]),
    ).toBe('item_1:2:50');
  });

  it('serves the checkout contact check to require()', () => {
    const contract = require('@podbor/catalog-contract');
    expect(
      contract.checkoutContactSchema.safeParse({ contact: 'call me' }).success,
    ).toBe(false);
  });

  it('serves the vehicle schemas to require()', () => {
    const contract = require('@podbor/catalog-contract');
    expect(contract.VEHICLE_IDENTIFIER_TYPES).toEqual([
      'bmw-type-code',
      'mercedes-baumuster',
    ]);
    expect(
      contract.vinLookupResponseSchema.safeParse({
        resolved: false,
        make: null,
        code: null,
      }).success,
    ).toBe(true);
  });
});
