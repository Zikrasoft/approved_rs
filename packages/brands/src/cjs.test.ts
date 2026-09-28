import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('CommonJS build', () => {
  it('resolves require() to dist/cjs', () => {
    expect(require.resolve('@podbor/brands')).toMatch(/dist\/cjs\/index\.js$/);
  });

  it('serves the workshop address and the brands to require()', () => {
    const brands = require('@podbor/brands');
    expect(brands.WORKSHOP_ADDRESS.country).toBe('RS');
    expect(brands.CARLAB.domain).toBe('carlab.rs');
    expect(brands.serviceLabel('parts-order')).toBe('Заказ из магазина');
  });
});
