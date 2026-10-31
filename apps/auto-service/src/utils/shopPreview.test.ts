import { describe, expect, it } from 'vitest';
import { previewRequested } from './catalogueEnv';
import { previewTokenFrom } from './shopPreview';

const TOKEN = 'preview-token-0123456789abcdef0123';

describe('previewTokenFrom', () => {
  it('reads the preview cookie, empty when there is none', () => {
    expect(
      previewTokenFrom(`lang=sr; auto_service_shop_preview=${TOKEN}`),
    ).toBe(TOKEN);
    expect(previewTokenFrom('lang=sr')).toBe('');
    expect(previewTokenFrom(null)).toBe('');
  });
});

describe('previewRequested', () => {
  const visitor = (cookie?: string) =>
    new Request('https://carlab.rs/sr/parts/', {
      headers: cookie ? { cookie } : {},
    });

  it('lets in only a cookie holding the site preview token', () => {
    const env = { SHOP_PREVIEW_TOKEN: TOKEN };

    expect(
      previewRequested(visitor(`auto_service_shop_preview=${TOKEN}`), env),
    ).toBe(true);
    expect(previewRequested(visitor('auto_service_shop_preview=1'), env)).toBe(
      false,
    );
    expect(previewRequested(visitor(), env)).toBe(false);
  });

  it('lets nobody in while the site has no valid token', () => {
    const cookie = 'auto_service_shop_preview=short';

    expect(previewRequested(visitor(cookie), {})).toBe(false);
    expect(
      previewRequested(visitor(cookie), { SHOP_PREVIEW_TOKEN: 'short' }),
    ).toBe(false);
  });
});
