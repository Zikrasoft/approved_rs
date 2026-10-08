import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { SITE_URL } from '@/utils/constants';
import { pageHead } from './pageHead';

const copy = { title: 'T', description: 'D' };

describe('pageHead', () => {
  it.each(SUPPORTED_LOCALES)(
    'builds canonical and alternates for a %s page',
    (locale) => {
      const head = pageHead(locale, `/${locale}/vehicle-sourcing/de/`, copy);

      expect(head.canonical).toBe(`${SITE_URL}/${locale}/vehicle-sourcing/de/`);
      expect(head.alternates).toEqual([
        { hreflang: 'ru', href: `${SITE_URL}/ru/vehicle-sourcing/de/` },
        { hreflang: 'en', href: `${SITE_URL}/en/vehicle-sourcing/de/` },
        { hreflang: 'sr', href: `${SITE_URL}/sr/vehicle-sourcing/de/` },
        { hreflang: 'es', href: `${SITE_URL}/es/vehicle-sourcing/de/` },
        { hreflang: 'de', href: `${SITE_URL}/de/vehicle-sourcing/de/` },
        { hreflang: 'x-default', href: `${SITE_URL}/ru/vehicle-sourcing/de/` },
      ]);
    },
  );

  it('points the bare site root at the locale homepage', () => {
    const head = pageHead('en', '/', copy);

    expect(head.canonical).toBe(`${SITE_URL}/en/`);
    expect(head.alternates.at(-1)).toEqual({
      hreflang: 'x-default',
      href: `${SITE_URL}/ru/`,
    });
  });

  it('keeps the 404 page on its own canonical', () => {
    expect(pageHead('ru', '/404/', copy).canonical).toBe(`${SITE_URL}/404/`);
  });

  it('carries the og:locale and the locale default og image', () => {
    const head = pageHead('sr', '/sr/', copy);

    expect(head.ogLocale).toBe('sr_RS');
    expect(head.ogImage).toBe(`${SITE_URL}/og-sr.png`);
    expect(pageHead('ru', '/ru/', copy).ogImage).toBe(`${SITE_URL}/og.png`);
  });

  it('keeps a page-supplied og image', () => {
    expect(
      pageHead('ru', '/ru/', { ...copy, ogImage: 'https://x/y.png' }).ogImage,
    ).toBe('https://x/y.png');
  });

  it('passes title and description through', () => {
    expect(pageHead('ru', '/ru/', copy)).toMatchObject(copy);
  });
});
