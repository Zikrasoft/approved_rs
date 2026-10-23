import { describe, expect, it } from 'vitest';

import { SHOP_PREVIEW_HEADER } from './preview.ts';

describe('SHOP_PREVIEW_HEADER', () => {
  it('is lower-case, as Node hands request headers to the shop', () => {
    expect(SHOP_PREVIEW_HEADER).toBe('x-shop-preview');
  });
});
