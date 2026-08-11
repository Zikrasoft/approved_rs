import { describe, it, expect } from 'vitest';
import { getAlternateLinks } from './hreflang';
import { SITE_URL } from '@/utils/constants';

describe('getAlternateLinks', () => {
  it('builds one link per locale plus x-default, preserving the path after the locale segment', () => {
    expect(getAlternateLinks('/en/vehicle-sourcing/de/')).toEqual([
      { hreflang: 'ru', href: `${SITE_URL}/ru/vehicle-sourcing/de/` },
      { hreflang: 'en', href: `${SITE_URL}/en/vehicle-sourcing/de/` },
      { hreflang: 'sr', href: `${SITE_URL}/sr/vehicle-sourcing/de/` },
      { hreflang: 'x-default', href: `${SITE_URL}/ru/vehicle-sourcing/de/` },
    ]);
  });

  it('handles the locale root path', () => {
    expect(getAlternateLinks('/ru/')).toEqual([
      { hreflang: 'ru', href: `${SITE_URL}/ru/` },
      { hreflang: 'en', href: `${SITE_URL}/en/` },
      { hreflang: 'sr', href: `${SITE_URL}/sr/` },
      { hreflang: 'x-default', href: `${SITE_URL}/ru/` },
    ]);
  });
});
