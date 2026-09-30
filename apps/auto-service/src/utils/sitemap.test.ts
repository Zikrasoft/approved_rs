import { describe, expect, it } from 'vitest';
import { sitemapFilter } from './sitemap';

const SITE = 'https://carlab.rs';

describe('sitemapFilter', () => {
  it.each(['off', 'preview'] as const)(
    'keeps shop pages out of the sitemap while %s',
    (status) => {
      const keep = sitemapFilter(SITE, status);
      expect(keep(`${SITE}/sr/shop/`)).toBe(false);
      expect(keep(`${SITE}/sr/shop/batteries/f/60ah/`)).toBe(false);
      expect(keep(`${SITE}/sr/services/`)).toBe(true);
    },
  );

  it('lists shop pages once the shop is live', () => {
    const keep = sitemapFilter(SITE, 'live');
    expect(keep(`${SITE}/en/shop/batteries/bosch-s4-024/`)).toBe(true);
  });

  it.each(['off', 'preview', 'live'] as const)(
    'never lists the root redirect, the cart or the thank-you page (%s)',
    (status) => {
      const keep = sitemapFilter(SITE, status);
      expect(keep(`${SITE}/`)).toBe(false);
      expect(keep(`${SITE}/sr/cart/`)).toBe(false);
      expect(keep(`${SITE}/sr/thanks/`)).toBe(false);
    },
  );
});
