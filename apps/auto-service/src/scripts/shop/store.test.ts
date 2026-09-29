import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreError, storeJson } from './store';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv('PUBLIC_MEDUSA_BACKEND_URL', 'http://store.test');
  vi.stubEnv('PUBLIC_MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('storeJson', () => {
  it('sends the publishable key, the query and a JSON body', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));

    await storeJson('/store/carts/c1', {
      method: 'POST',
      params: { fields: '+items.total' },
      body: { locale: 'sr-RS' },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'http://store.test/store/carts/c1?fields=%2Bitems.total',
    );
    expect(init).toEqual({
      method: 'POST',
      headers: {
        'x-publishable-api-key': 'pk_test',
        'content-type': 'application/json',
      },
      body: '{"locale":"sr-RS"}',
    });
  });

  it('turns an error answer into a StoreError carrying Medusa code', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { type: 'not_allowed', code: 'insufficient_inventory' },
        { status: 400 },
      ),
    );

    const error = await storeJson<never>('/store/carts/c1/line-items').catch(
      (e) => e as StoreError,
    );

    expect(error).toBeInstanceOf(StoreError);
    expect([error.status, error.code]).toEqual([400, 'insufficient_inventory']);
  });

  it('keeps the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('down', { status: 502 }));

    const error = await storeJson<never>('/store/regions').catch(
      (e) => e as StoreError,
    );

    expect([error.status, error.code]).toEqual([502, null]);
  });

  it('refuses to guess a backend when the build had none', async () => {
    vi.stubEnv('PUBLIC_MEDUSA_BACKEND_URL', '');

    await expect(storeJson('/store/regions')).rejects.toThrow(
      'PUBLIC_MEDUSA_BACKEND_URL',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
