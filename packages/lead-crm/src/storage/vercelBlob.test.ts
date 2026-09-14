import { describe, it, expect, vi, beforeEach } from 'vitest';

class FakePreconditionFailedError extends Error {}

const get = vi.fn();
const head = vi.fn();
const put = vi.fn();

vi.mock('@vercel/blob', () => ({
  get: (...args: unknown[]) => get(...args),
  head: (...args: unknown[]) => head(...args),
  put: (...args: unknown[]) => put(...args),
  BlobPreconditionFailedError: FakePreconditionFailedError,
}));

const { createVercelBlobStorage } = await import('./vercelBlob.ts');
const { StorageConflictError } = await import('./types.ts');

const storage = createVercelBlobStorage({ path: 'data/leads.json' });

beforeEach(() => {
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
