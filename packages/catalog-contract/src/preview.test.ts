import { describe, expect, it } from 'vitest';

import {
  SHOP_PREVIEW_HEADER,
  shopOpenSchema,
  shopPreviewTokenSchema,
} from './preview.ts';

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

describe('shopPreviewTokenSchema', () => {
  it('takes a URL-safe token of at least 32 characters', () => {
    expect(shopPreviewTokenSchema.safeParse('a'.repeat(32)).success).toBe(true);
    expect(shopPreviewTokenSchema.safeParse('a'.repeat(31)).success).toBe(
      false,
    );
    expect(shopPreviewTokenSchema.safeParse('1').success).toBe(false);
    expect(shopPreviewTokenSchema.safeParse(`${'a'.repeat(32)};`).success).toBe(
      false,
    );
  });
});
