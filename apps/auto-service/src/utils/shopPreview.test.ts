import { describe, expect, it } from 'vitest';
import { previewFrom, previewRequested } from './shopPreview';

describe('previewFrom', () => {
  it('reads the flag a server sees: the address first, then the cookie', () => {
    expect(previewFrom('', 'lang=sr; carlab_shop_preview=1')).toBe(true);
    expect(previewFrom('?dev=1', '')).toBe(true);
    expect(previewFrom('?dev=0', 'carlab_shop_preview=1')).toBe(false);
    expect(previewFrom('', 'carlab_shop_preview=10')).toBe(false);
    expect(previewFrom('', null)).toBe(false);
  });
});

describe('previewRequested', () => {
  it('reads the flag off the request address and cookie', () => {
    expect(
      previewRequested(new Request('https://carlab.rs/sr/parts/?dev=1')),
    ).toBe(true);
    expect(
      previewRequested(
        new Request('https://carlab.rs/sr/parts/', {
          headers: { cookie: 'carlab_shop_preview=1' },
        }),
      ),
    ).toBe(true);
    expect(previewRequested(new Request('https://carlab.rs/sr/parts/'))).toBe(
      false,
    );
  });
});
