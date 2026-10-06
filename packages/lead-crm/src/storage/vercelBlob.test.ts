import { describe, it, expect, vi, beforeEach } from 'vitest';

class FakePreconditionFailedError extends Error {}
class FakeNotFoundError extends Error {}

const del = vi.fn();
const get = vi.fn();
const head = vi.fn();
const put = vi.fn();

vi.mock('@vercel/blob', () => ({
  del: (...args: unknown[]) => del(...args),
  get: (...args: unknown[]) => get(...args),
  head: (...args: unknown[]) => head(...args),
  put: (...args: unknown[]) => put(...args),
  BlobNotFoundError: FakeNotFoundError,
  BlobPreconditionFailedError: FakePreconditionFailedError,
}));

const { createVercelBlobStorage, createBlobOrderMarkers } =
  await import('./vercelBlob.ts');
const { StorageConflictError } = await import('./types.ts');

const storage = createVercelBlobStorage({ path: 'data/leads.json' });

beforeEach(() => {
  del.mockReset();
  get.mockReset();
  head.mockReset();
  put.mockReset();
});

describe('read', () => {
  it('reports an empty snapshot when nothing is stored yet', async () => {
    get.mockResolvedValue(null);

    await expect(storage.read()).resolves.toEqual({
      raw: undefined,
      version: undefined,
    });
    // No blob means no etag to fetch.
    expect(head).not.toHaveBeenCalled();
  });

  it('parses the stored JSON and takes the version from head(), not from get()', async () => {
    // get()'s own etag has been observed stale in production — the adapter
    // must ignore it and use head()'s instead.
    get.mockResolvedValue({
      stream: new Response('[{"id":1}]').body,
      blob: { etag: 'stale-etag' },
    });
    head.mockResolvedValue({ etag: 'fresh-etag' });

    await expect(storage.read()).resolves.toEqual({
      raw: [{ id: 1 }],
      version: 'fresh-etag',
    });
  });

  it('reads past the cache so a conditional write cannot be fed a stale etag', async () => {
    get.mockResolvedValue({ stream: new Response('[]').body });
    head.mockResolvedValue({ etag: 'e1' });

    await storage.read();

    expect(get).toHaveBeenCalledWith('data/leads.json', {
      access: 'private',
      useCache: false,
    });
  });
});

describe('write', () => {
  it('sends a conditional write when a version is known', async () => {
    put.mockResolvedValue({ etag: 'e2' });

    await storage.write([{ id: 1 }], 'e1');

    expect(put).toHaveBeenCalledWith(
      'data/leads.json',
      '[{"id":1}]',
      expect.objectContaining({
        access: 'private',
        allowOverwrite: true,
        contentType: 'application/json',
        ifMatch: 'e1',
      }),
    );
  });

  it('omits ifMatch on the very first write, when there is no blob to match', async () => {
    put.mockResolvedValue({ etag: 'e1' });

    await storage.write([], undefined);

    expect(put.mock.calls[0]![2]).not.toHaveProperty('ifMatch');
  });

  it('translates a losing conditional write into a storage conflict', async () => {
    put.mockRejectedValue(
      new FakePreconditionFailedError('precondition failed'),
    );

    await expect(storage.write([], 'e1')).rejects.toBeInstanceOf(
      StorageConflictError,
    );
  });

  it('lets any other write failure through untouched', async () => {
    const boom = new Error('network down');
    put.mockRejectedValue(boom);

    await expect(storage.write([], 'e1')).rejects.toBe(boom);
  });
});

describe('createBlobOrderMarkers', () => {
  const markers = createBlobOrderMarkers();

  it('takes one private marker per order and never overwrites it', async () => {
    await markers.add('order_01/../x');

    expect(put).toHaveBeenCalledWith(
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

  it('knows a taken marker from an untaken one', async () => {
    head.mockResolvedValueOnce({});
    await expect(markers.has('o1')).resolves.toBe(true);

    head.mockRejectedValueOnce(new FakeNotFoundError());
    await expect(markers.has('o2')).resolves.toBe(false);
  });

  it('passes any other storage failure up, so no second lead is stored', async () => {
    const boom = new Error('store suspended');
    head.mockRejectedValueOnce(boom);

    await expect(markers.has('o3')).rejects.toBe(boom);
  });

  it('releases a marker by deleting its blob', async () => {
    await markers.release('order_01/../x');

    expect(del).toHaveBeenCalledWith('shop-orders/order_01%2F..%2Fx.json');
  });
});
