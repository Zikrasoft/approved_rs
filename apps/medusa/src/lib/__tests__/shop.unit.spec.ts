import { CARLAB } from '@podbor/brands';
import { PRODUCT_TYPES } from '@podbor/shop-catalog';

import {
  FALLBACK_LOCALE,
  INSTALLATION_TITLES,
  SERBIAN_LOCALE,
  SHOP,
  STORE_LOCALES,
  shopLocale,
} from '../shop';

describe('shopLocale', () => {
  it.each([
    ['ru-RU', 'ru'],
    ['sr-RS', 'sr'],
    ['en-US', 'en'],
  ])('reads %s as %s', (medusa, shop) => {
    expect(shopLocale(medusa)).toBe(shop);
  });

  it.each([null, undefined, '', 'de-DE', 'sr'])(
    'falls back to the site language for %p',
    (value) => {
      expect(shopLocale(value)).toBe(FALLBACK_LOCALE);
    },
  );

  it("falls back to Serbian, carlab.rs's primary language", () => {
    expect(FALLBACK_LOCALE).toBe('sr');
  });
});

describe('store locales', () => {
  it('offers the three site languages and creates the Serbian one Medusa does not seed', () => {
    expect(STORE_LOCALES).toEqual(['sr-RS', 'en-US', 'ru-RU']);
    expect(SERBIAN_LOCALE).toEqual({ code: 'sr-RS', name: 'Srpski' });
  });
});

describe('SHOP identity', () => {
  it('pins the seeded sales channel, publishable key and location to the CarLab brand, byte-identical', () => {
    expect(SHOP.salesChannelName).toBe(CARLAB.domain);
    expect(SHOP.publishableKeyTitle).toBe(CARLAB.domain);
    expect(SHOP.locationName).toBe(CARLAB.name);
    expect(SHOP.salesChannelName).toBe('carlab.rs');
    expect(SHOP.publishableKeyTitle).toBe('carlab.rs');
    expect(SHOP.locationName).toBe('CarLab');
  });
});

describe('INSTALLATION_TITLES', () => {
  it('names every installation service the registry offers, and nothing else', () => {
    const handles = PRODUCT_TYPES.flatMap((type) =>
      type.installation ? [type.installation] : [],
    );

    expect(Object.keys(INSTALLATION_TITLES).sort()).toEqual(handles.sort());
  });
});
