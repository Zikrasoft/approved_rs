import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { GET } from './shop-preview';

const TOKEN = 'preview-token-0123456789abcdef0123';

beforeEach(() => {
  vi.stubEnv('SHOP_PREVIEW_TOKEN', TOKEN);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const open = async (query: string) => {
  const cookies = { set: vi.fn(), delete: vi.fn() };
  const response = await GET({
    url: new URL(`https://carlab.rs/api/shop-preview${query}`),
    cookies,
    redirect: (location: string, status: number) =>
      new Response(null, { status, headers: { location } }),
  } as unknown as APIContext);
  return { response, cookies };
};

describe('/api/shop-preview', () => {
  it('remembers the right token for a year and sends the tester to the parts', async () => {
    const { response, cookies } = await open(`?token=${TOKEN}`);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/sr/parts/');
    expect(cookies.set).toHaveBeenCalledWith(
      'auto_service_shop_preview',
      TOKEN,
      expect.objectContaining({ path: '/', secure: true, sameSite: 'lax' }),
    );
  });

  it('refuses a wrong token and remembers nothing', async () => {
    const { response, cookies } = await open('?token=1');

    expect(response.status).toBe(403);
    expect(cookies.set).not.toHaveBeenCalled();
  });

  it('forgets the preview without a token', async () => {
    const { response, cookies } = await open('');

    expect(response.status).toBe(302);
    expect(cookies.delete).toHaveBeenCalledWith('auto_service_shop_preview', {
      path: '/',
    });
  });
});
