import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { SITE_URL } from '@/utils/constants';
import { NOINDEX, pageHead } from './pageHead';
import { PathBuilder } from './paths';

const copy = { title: 'T', description: 'D' };

describe('pageHead', () => {
  it.each(SUPPORTED_LOCALES)(
    'builds canonical and alternates for a %s page',
    (locale) => {
      const head = pageHead(locale, `/${locale}/services/`, copy);

      expect(head.canonical).toBe(`${SITE_URL}/${locale}/services/`);
      expect(head.alternates).toEqual([
        { hreflang: 'ru', href: `${SITE_URL}/ru/services/` },
        { hreflang: 'sr', href: `${SITE_URL}/sr/services/` },
        { hreflang: 'en', href: `${SITE_URL}/en/services/` },
        { hreflang: 'x-default', href: `${SITE_URL}/sr/services/` },
      ]);
    },
  );

  it.each(SUPPORTED_LOCALES)(
    'keeps a %s Category page past the first canonical to itself',
    (locale) => {
      const head = pageHead(
        locale,
        PathBuilder.partsCategory(locale, 'oil-filters', 2),
        copy,
      );

      expect(head.canonical).toBe(
        `${SITE_URL}/${locale}/parts/c/oil-filters/2/`,
      );
      expect(head.alternates.at(-1)).toEqual({
        hreflang: 'x-default',
        href: `${SITE_URL}/sr/parts/c/oil-filters/2/`,
      });
    },
  );

  it('keeps a noindex page followed', () => {
    expect(NOINDEX).toBe('noindex, follow');
  });

  it('points the bare site root at the locale homepage', () => {
    const head = pageHead('en', '/', copy);

    expect(head.canonical).toBe(`${SITE_URL}/en/`);
    expect(head.alternates.at(-1)).toEqual({
      hreflang: 'x-default',
      href: `${SITE_URL}/sr/`,
    });
  });

  it('carries the og:locale and the locale og image', () => {
    const head = pageHead('ru', '/ru/', copy);

    expect(head.ogLocale).toBe('ru_RU');
    expect(head.ogImage).toBe(`${SITE_URL}/og-ru.png`);
    expect(pageHead('sr', '/sr/', copy).ogImage).toBe(`${SITE_URL}/og.png`);
  });
});
