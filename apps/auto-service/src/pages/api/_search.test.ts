import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { GET } from './search';

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

const suggest = async (query: string) => {
  const response = await (GET({
    url: new URL(`http://localhost/api/search?${query}`),
    request: new Request(`http://localhost/api/search?${query}`),
  } as unknown as APIContext) as Promise<Response>);
  return response.json();
};

const answer = {
  results: [],
  facets: [],
  category: null,
  model: null,
  cars: [
    {
      kind: 'make',
      make: { slug: 'bmw', name: 'BMW' },
      model: null,
      vehicle: null,
    },
  ],
  count: 0,
  offset: 0,
  limit: 5,
};

describe('/api/search', () => {
  it('suggests the cars and parts the shop finds, linked for the page locale', async () => {
    backend.mockResolvedValue(Response.json(answer));

    expect(await suggest('q=bmw&locale=sr')).toEqual({
      vin: false,
      cars: [{ href: '/sr/parts/bmw/', label: 'BMW' }],
      parts: [],
    });
    expect(backend.mock.calls[0][0]).toBe(
      'http://shop.test/store/search?q=bmw&locale=sr&limit=5',
    );
  });

  it('offers the VIN lookup for a VIN without asking the shop', async () => {
    expect(await suggest('q=WBA35BG070N074158&locale=ru')).toEqual({
      vin: true,
      cars: [],
      parts: [],
    });
    expect(backend).not.toHaveBeenCalled();
  });

  it('suggests nothing for a query with no letters or digits', async () => {
    expect(await suggest('q=%20-%20&locale=ru')).toEqual({
      vin: false,
      cars: [],
      parts: [],
    });
    expect(backend).not.toHaveBeenCalled();
  });

  it('suggests nothing while the shop is unreachable', async () => {
    backend.mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await suggest('q=bmw&locale=ru')).toEqual({
      vin: false,
      cars: [],
      parts: [],
    });
  });
});
