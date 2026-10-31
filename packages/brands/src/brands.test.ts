import { describe, it, expect } from 'vitest';
import {
  BRAND_LOCALES,
  brandLocale,
  developerCreditUrl,
  splitDeveloperCredit,
  isBrandLocale,
  socialLinks,
  WORKSHOP_ADDRESS,
  type BrandKey,
} from './brands.ts';
import { BRANDS, BRAND_SITES } from './registry.ts';

const KEYS = Object.keys(BRANDS) as BrandKey[];

describe('brand registry', () => {
  it.each(KEYS)('derives %s site url from its bare domain', (key) => {
    expect(BRAND_SITES[key]).toBe(`https://${BRANDS[key].domain}`);
  });

  it.each(KEYS)('keeps %s keyed by itself', (key) => {
    expect(BRANDS[key].url).toBe(BRAND_SITES[key]);
    expect(BRANDS[key].key).toBe(key);
  });

  it('stores bare domains without a scheme or trailing slash', () => {
    for (const key of KEYS) {
      expect(BRANDS[key].domain).not.toMatch(/^https?:|\/$/);
    }
  });

  it.each([
    ['approved', 'ApprovedRsBot'],
    ['carlab', 'CarLabRsBot'],
    ['details', 'DetailsRsBot'],
  ] as const)('stores %s capture bot bare, without a leading @', (key, bot) => {
    expect(BRANDS[key].captureBot).toBe(bot);
  });

  it('gives every brand a distinct capture bot', () => {
    expect(new Set(KEYS.map((key) => BRANDS[key].captureBot)).size).toBe(
      KEYS.length,
    );
  });

  it('gives every brand a distinct domain', () => {
    expect(new Set(KEYS.map((key) => BRANDS[key].domain)).size).toBe(
      KEYS.length,
    );
  });
});

describe('brandLocale', () => {
  it.each(BRAND_LOCALES)('passes %s through untouched', (locale) => {
    expect(brandLocale(locale)).toBe(locale);
  });

  it.each(['es', 'de'])('falls back to en for %s', (locale) => {
    expect(brandLocale(locale)).toBe('en');
  });

  it('falls back to en for an unknown value', () => {
    expect(brandLocale('zz')).toBe('en');
  });
});

describe('isBrandLocale', () => {
  it('accepts a brand locale', () => {
    expect(isBrandLocale('sr')).toBe(true);
  });

  it('rejects a locale the brand sites do not have', () => {
    expect(isBrandLocale('de')).toBe(false);
  });
});

describe('WORKSHOP_ADDRESS', () => {
  it('holds a decimal Google Maps cid, not a hex ftid or a place_id', () => {
    expect(WORKSHOP_ADDRESS.googleMapsCid).toMatch(/^\d+$/);
  });
});

describe('developerCreditUrl', () => {
  it('tags the studio link with the brand site it came from', () => {
    expect(developerCreditUrl({ domain: 'carlab.rs' })).toBe(
      'https://zikrasoft.com/?utm_source=carlab.rs&utm_medium=referral&utm_campaign=footer_credit',
    );
  });
});

describe('socialLinks', () => {
  it('lists the configured accounts in a fixed network order', () => {
    expect(
      socialLinks({
        youtube: 'https://youtube.com/@carlab',
        instagram: 'https://instagram.com/carlab',
      }),
    ).toEqual([
      {
        network: 'instagram',
        name: 'Instagram',
        url: 'https://instagram.com/carlab',
      },
      {
        network: 'youtube',
        name: 'YouTube',
        url: 'https://youtube.com/@carlab',
      },
    ]);
  });

  it('renders nothing for an empty, blank or absent url', () => {
    expect(socialLinks({ instagram: '', facebook: '  ' })).toEqual([]);
    expect(socialLinks({})).toEqual([]);
  });
});

describe('splitDeveloperCredit', () => {
  it('splits the label around the studio name', () => {
    expect(splitDeveloperCredit('Сайт сделан в Zikrasoft')).toEqual({
      before: 'Сайт сделан в ',
      after: '',
    });
    expect(splitDeveloperCredit('Zikrasoft がつくりました')).toEqual({
      before: '',
      after: ' がつくりました',
    });
  });

  it('drops a label that lost the studio name in translation', () => {
    expect(splitDeveloperCredit('Сайт сделан в Зикрасофт')).toEqual({
      before: '',
      after: '',
    });
  });
});
