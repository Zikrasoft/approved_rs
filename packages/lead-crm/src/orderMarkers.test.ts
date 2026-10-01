import { describe, expect, it } from 'vitest';
import { ORDER_MARKER_PREFIX, markerBody, markerPath } from './orderMarkers.ts';

describe('markerPath', () => {
  it('keeps one path per order and cannot escape the prefix', () => {
    expect(markerPath('order_01')).toBe(`${ORDER_MARKER_PREFIX}order_01.json`);
    expect(markerPath('order_01/../x')).toBe(
      'shop-orders/order_01%2F..%2Fx.json',
    );
  });
});

describe('markerBody', () => {
  it('records the order it was taken for and when', () => {
    expect(JSON.parse(markerBody('order_01'))).toEqual({
      orderId: 'order_01',
      at: expect.any(String),
    });
  });
});
