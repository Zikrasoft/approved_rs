import { describe, expect, it } from 'vitest';
import { sitemapFilter } from './sitemap';

const SITE = 'https://carlab.rs';

describe('sitemapFilter', () => {
  it('keeps ordinary pages', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/sr/services/`)).toBe(true);
    expect(keep(`${SITE}/sr/parts/makes/`)).toBe(true);
    expect(keep(`${SITE}/sr/services/vin-parts-inquiry/`)).toBe(true);
  });

  it('lists the Make pages', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/sr/cars/bmw/`)).toBe(true);
    expect(keep(`${SITE}/en/cars/mercedes-benz/`)).toBe(true);
  });

  it('lists the blog, its later pages and every Article', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/sr/blog/`)).toBe(true);
    expect(keep(`${SITE}/sr/blog/2/`)).toBe(true);
    expect(keep(`${SITE}/sr/blog/oil-change/`)).toBe(true);
  });

  it('never lists the root redirect or the thank-you page', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/`)).toBe(false);
    expect(keep(`${SITE}/sr/thanks/`)).toBe(false);
  });
});
