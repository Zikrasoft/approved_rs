import { beforeEach, describe, expect, it, vi } from 'vitest';

const blob = vi.hoisted(() => {
  class BlobNotFoundError extends Error {}
  return { head: vi.fn(), put: vi.fn(), BlobNotFoundError };
});
vi.mock('@vercel/blob', () => blob);

const { markerPath, orderMarkers } = await import('./orderMarkers');

beforeEach(() => vi.clearAllMocks());

describe('order markers', () => {
  it('keeps one private file per order, never overwriting', async () => {
    await orderMarkers.add('order_01/../x');

    expect(markerPath('order_01/../x')).toBe(
      'shop-orders/order_01%2F..%2Fx.json',
    );
    expect(blob.put).toHaveBeenCalledWith(
      'shop-orders/order_01%2F..%2Fx.json',
      expect.stringContaining('order_01/../x'),
      {
        access: 'private',
        allowOverwrite: false,
        addRandomSuffix: false,
        contentType: 'application/json',
      },
    );
  });

  it('knows a seen order, an unseen one, and passes storage failures up', async () => {
    blob.head.mockResolvedValueOnce({});
    expect(await orderMarkers.has('o1')).toBe(true);

    blob.head.mockRejectedValueOnce(new blob.BlobNotFoundError());
    expect(await orderMarkers.has('o2')).toBe(false);

    blob.head.mockRejectedValueOnce(new Error('store suspended'));
    await expect(orderMarkers.has('o3')).rejects.toThrow('store suspended');
  });
});
