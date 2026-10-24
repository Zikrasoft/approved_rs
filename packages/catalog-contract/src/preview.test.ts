import { describe, expect, it } from 'vitest';

import { SHOP_PREVIEW_HEADER, shopOpenSchema } from './preview.ts';

describe('SHOP_PREVIEW_HEADER', () => {
  it('is lower-case, as Node hands request headers to the shop', () => {
    expect(SHOP_PREVIEW_HEADER).toBe('x-shop-preview');
  });
});

describe('shopOpenSchema', () => {
  it('reads true and false, and leaves an unset or empty flag to the caller', () => {
    expect(shopOpenSchema.parse('true')).toBe(true);
    expect(shopOpenSchema.parse('false')).toBe(false);
    expect(shopOpenSchema.parse('')).toBeUndefined();
    expect(shopOpenSchema.parse(undefined)).toBeUndefined();
  });

  it('refuses any other spelling', () => {
    expect(shopOpenSchema.safeParse('yes').success).toBe(false);
  });
});
