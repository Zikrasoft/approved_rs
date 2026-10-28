import { describe, expect, it } from 'vitest';
import { sitemapFilter } from './sitemap';

const SITE = 'https://carlab.rs';

describe('sitemapFilter', () => {
  it('keeps ordinary pages', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/sr/services/`)).toBe(true);
    expect(keep(`${SITE}/sr/parts/makes/`)).toBe(true);
  });

  it('never lists the root redirect or the thank-you page', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/`)).toBe(false);
    expect(keep(`${SITE}/sr/thanks/`)).toBe(false);
  });
});
