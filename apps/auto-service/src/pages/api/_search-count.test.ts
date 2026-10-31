import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { GET } from './search-count';

const backend = vi.fn();

beforeEach(() => {
  vi.stubEnv('MEDUSA_BACKEND_URL', 'http://shop.test');
  vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  vi.stubGlobal('fetch', backend);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  backend.mockReset();
});

const ask = (query: string) =>
  GET({
    url: new URL(`http://localhost/api/search-count?${query}`),
    request: new Request(`http://localhost/api/search-count?${query}`),
  } as unknown as APIContext) as Promise<Response>;

const answer = {
  results: [],
  facets: [],
  category: null,
  model: null,
  cars: [],
  count: 81,
  offset: 0,
  limit: 1,
};

describe('/api/search-count', () => {
  it('counts what the filter sheet would show, with its facets and ranges', async () => {
    backend.mockResolvedValue(Response.json(answer));

    const response = await ask(
      'category=batteries&facets=technology%3Aagm&min.capacity=80&locale=sr',
    );

    expect(await response.json()).toEqual({ count: 81 });
    expect(backend.mock.calls[0][0]).toBe(
      'http://shop.test/store/search?locale=sr&category=batteries&facets=technology%3Aagm&range=capacity%3A80%3A&limit=1',
    );
  });

  it('counts nothing for a malformed scope without asking the shop', async () => {
    const response = await ask('category=..%2Fadmin&locale=ru');

    expect(await response.json()).toEqual({ count: null });
    expect(backend).not.toHaveBeenCalled();
  });

  it('says the count is unavailable while the shop is unreachable', async () => {
    backend.mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await ask('q=varta&locale=ru')).status).toBe(503);
  });
});
