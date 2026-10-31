import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/mini';
import { getJson } from './cartUi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getJson', () => {
  it('asks the network every time, never the HTTP cache', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ kind: 'empty' }));
    vi.stubGlobal('fetch', fetch);

    await getJson(z.object({ kind: z.string() }), '/api/cart?id=cart_1', {
      method: 'GET',
    });

    expect(fetch).toHaveBeenCalledWith('/api/cart?id=cart_1', {
      cache: 'no-store',
      method: 'GET',
    });
  });
});
