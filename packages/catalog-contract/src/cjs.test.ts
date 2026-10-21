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
});
