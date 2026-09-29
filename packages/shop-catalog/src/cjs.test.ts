import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('CommonJS build', () => {
  it('resolves every Medusa-facing subpath to dist/cjs', () => {
    expect(require.resolve('@podbor/shop-catalog')).toMatch(
      /dist\/cjs\/index\.js$/,
    );
    expect(require.resolve('@podbor/shop-catalog/browser')).toMatch(
      /dist\/cjs\/browser\.js$/,
    );
    expect(require.resolve('@podbor/shop-catalog/order-hook')).toMatch(
      /dist\/cjs\/orderHook\.js$/,
    );
  });

  it('serves the package root to require()', () => {
    const shop = require('@podbor/shop-catalog');
    expect(shop.productType('batteries').key).toBe('batteries');
    expect(shop.parseAttributes('batteries', {}).ok).toBe(false);
    expect(shop.landingSlug(shop.productType('batteries').fields[1], 60)).toBe(
      '60ah',
    );
    expect(shop.vehicleFitment({ makes: [] })).toEqual([]);
    expect(shop.vehicleTreeSchema.safeParse({ makes: [] }).success).toBe(true);
  });

  it('serves the browser subpath to require()', () => {
    const browser = require('@podbor/shop-catalog/browser');
    expect(browser.MEDUSA_LOCALE.sr).toBe('sr-RS');
    expect(browser.CART_METADATA.honeypot).toBe('website');
    expect(browser.PICKUP_OPTION_CODE).toBe('pickup');
  });

  it('serves the order hook to require()', () => {
    const hook = require('@podbor/shop-catalog/order-hook');
    const header = hook.signHook('{}', 'secret', 1_790_000_000_000);
    expect(hook.verifyHook('{}', header, 'secret', 1_790_000_000_000)).toBe(
      true,
    );
  });
});
