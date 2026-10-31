import { describe, expect, it } from 'vitest';
import { shopPreview } from './shopPreview';

describe('shopPreview', () => {
  it('turns the preview on for a browser holding a preview cookie', () => {
    expect(shopPreview({ cookie: 'auto_service_shop_preview=token' })).toBe(
      true,
    );
    expect(shopPreview({ cookie: 'lang=sr' })).toBe(false);
  });
});
