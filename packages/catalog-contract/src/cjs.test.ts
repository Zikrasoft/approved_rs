import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('CommonJS build', () => {
  it('resolves the package root to dist/cjs', () => {
    expect(require.resolve('@podbor/catalog-contract')).toMatch(
      /dist\/cjs\/index\.js$/,
    );
  });

  it('serves the schemas to require()', () => {
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
