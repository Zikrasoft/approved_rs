import { describe, expect, it } from 'vitest';
import { sitemapFilter } from './sitemap';

const SITE = 'https://carlab.rs';

describe('sitemapFilter', () => {
  it('keeps ordinary pages', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/sr/services/`)).toBe(true);
  });

  it('never lists the root redirect or the thank-you page', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/`)).toBe(false);
    expect(keep(`${SITE}/sr/thanks/`)).toBe(false);
  });

  it('keeps a Vehicle page out when its Model page is its canonical', () => {
    const car = (id: string, slug: string, solitary: boolean) => ({
      solitary,
      vehicle: {
        id,
        slug,
        model: {
          slug: 'f30-320d',
          chassis: { series: { make: { slug: 'bmw' } } },
        },
      },
    });
    const keep = sitemapFilter(
      SITE,
      [],
      [
        car('veh_1', 'b47d20o0-140kw', true),
        car('veh_2', 'n47d20c-105kw', false),
      ],
    );

    expect(keep(`${SITE}/sr/parts/bmw/f30-320d/m/b47d20o0-140kw/`)).toBe(false);
    expect(keep(`${SITE}/en/parts/bmw/f30-320d/m/b47d20o0-140kw/`)).toBe(false);
    expect(keep(`${SITE}/sr/parts/bmw/f30-320d/m/n47d20c-105kw/`)).toBe(true);
    expect(keep(`${SITE}/sr/parts/bmw/f30-320d/`)).toBe(true);
  });
});
