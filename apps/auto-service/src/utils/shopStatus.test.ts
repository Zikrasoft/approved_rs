import { describe, expect, it } from 'vitest';
import { devOnly, readShopStatus, shopBuilt, shopIndexed } from './shopStatus';

describe('readShopStatus', () => {
  it('is off unless the build says otherwise', () => {
    expect(readShopStatus({})).toBe('off');
  });

  it.each(['off', 'preview', 'live'])('accepts %s', (status) => {
    expect(readShopStatus({ SHOP_STATUS: status })).toBe(status);
  });

  it.each(['', 'on', 'LIVE', 'true'])(
    'fails the build on %j instead of guessing',
    (status) => {
      expect(() => readShopStatus({ SHOP_STATUS: status })).toThrow();
    },
  );
});

describe('what each status shows', () => {
  it('builds the shop in preview and live, never off', () => {
    expect([shopBuilt('off'), shopBuilt('preview'), shopBuilt('live')]).toEqual(
      [false, true, true],
    );
  });

  it('lets search engines see the shop only when live', () => {
    expect([
      shopIndexed('off'),
      shopIndexed('preview'),
      shopIndexed('live'),
    ]).toEqual([false, false, true]);
  });

  it('marks shop links dev-only in preview and renders no marker at all when live', () => {
    expect(devOnly('preview')).toEqual({ 'data-dev-only': '' });
    expect(devOnly('live')).toEqual({});
    expect(devOnly('off')).toEqual({});
  });
});
