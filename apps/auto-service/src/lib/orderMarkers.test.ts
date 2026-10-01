import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const blob = vi.hoisted(() => {
  class BlobNotFoundError extends Error {}
  return { head: vi.fn(), put: vi.fn(), BlobNotFoundError };
});
vi.mock('@vercel/blob', () => blob);

const { markerPath, blobOrderMarkers, orderMarkers } =
  await import('./orderMarkers');

beforeEach(() => vi.clearAllMocks());

describe('order markers on Vercel Blob', () => {
  it('keeps one private file per order, never overwriting', async () => {
    await blobOrderMarkers.add('order_01/../x');

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
    expect(await blobOrderMarkers.has('o1')).toBe(true);

    blob.head.mockRejectedValueOnce(new blob.BlobNotFoundError());
    expect(await blobOrderMarkers.has('o2')).toBe(false);

    blob.head.mockRejectedValueOnce(new Error('store suspended'));
    await expect(blobOrderMarkers.has('o3')).rejects.toThrow('store suspended');
  });
});

describe('order markers on the local filesystem, which dev selects', () => {
  const orderId = `order_${process.pid}/../x`;

  afterAll(async () => {
    const { rm } = await import('node:fs/promises');
    const { LOCAL_LEADS_DIR } = await import('./localStorageDir');
    await rm(`${LOCAL_LEADS_DIR}/${markerPath(orderId)}`, { force: true });
  });

  it('keeps one file per order and refuses to write it twice', async () => {
    expect(await orderMarkers.has(orderId)).toBe(false);

    await orderMarkers.add(orderId);
    expect(await orderMarkers.has(orderId)).toBe(true);

    await expect(orderMarkers.add(orderId)).rejects.toThrow(/EEXIST/);
  });
});
