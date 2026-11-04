import { describe, expect, it } from 'vitest';
import { shopPreview } from './shopPreview';

describe('shopPreview', () => {
  it('turns the preview on for a browser holding the preview flag', () => {
    expect(
      shopPreview({ cookie: 'lang=sr; auto_service_shop_preview_on=1' }),
    ).toBe(true);
    expect(shopPreview({ cookie: 'lang=sr' })).toBe(false);
  });

  it('ignores the token cookie, which page scripts can no longer read', () => {
    expect(shopPreview({ cookie: 'auto_service_shop_preview=token' })).toBe(
      false,
    );
  });
});
