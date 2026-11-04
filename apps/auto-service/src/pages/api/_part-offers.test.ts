import { afterEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { GET } from './part-offers';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/api/part-offers', () => {
  it('keeps the live offers out of the browser cache', async () => {
    vi.stubEnv('MEDUSA_BACKEND_URL', '');

    const response = await GET({
      url: new URL('http://localhost/api/part-offers?id=part_1'),
      request: new Request('http://localhost/api/part-offers?id=part_1'),
    } as unknown as APIContext);

    expect(await response.json()).toEqual({ kind: 'inquiry' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
