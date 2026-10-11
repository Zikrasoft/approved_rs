import { describe, it, expect } from 'vitest';
import {
  PARTNER_SERVICE,
  SERVICE_LABELS_RU,
  SERVICE_SLUGS_BY_BRAND,
  isBrandServiceSlug,
  isPartnerService,
  serviceLabel,
} from './serviceLabels.ts';
import { BRANDS } from './registry.ts';

const FORM_ONLY_SLUGS = [
  'vehicle-import-de',
  'vehicle-import-es',
  'vehicle-import-ch',
  'vehicle-import-eu',
  'vehicle-import-china',
  'parts-order',
];
const LEGACY_SLUGS = ['auto-service-belgrade', 'detailing-belgrade'];
const PARTNER_SLUGS = Object.values(PARTNER_SERVICE);

describe('serviceLabel', () => {
  it('returns the Russian label for a known slug', () => {
    expect(serviceLabel('vehicle-sourcing')).toBe('Автоподбор');
  });

  it('falls back to the raw slug for an unknown one', () => {
    expect(serviceLabel('no-such-service')).toBe('no-such-service');
  });

  it('still labels the retired approved.rs slugs stored leads carry', () => {
    expect(serviceLabel('auto-service-belgrade')).toBe('Автосервис');
    expect(serviceLabel('detailing-belgrade')).toBe('Детейлинг');
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'falls back to the raw slug for the inherited key %s',
    (slug) => {
      expect(serviceLabel(slug)).toBe(slug);
    },
  );
});

describe('SERVICE_SLUGS_BY_BRAND', () => {
  it('lists a non-empty slug list for every brand', () => {
    expect(Object.keys(SERVICE_SLUGS_BY_BRAND).sort()).toEqual(
      Object.keys(BRANDS).sort(),
    );
    for (const slugs of Object.values(SERVICE_SLUGS_BY_BRAND)) {
      expect(slugs.length).toBeGreaterThan(0);
    }
  });

  it.each(['approved', 'carlab', 'details'] as const)(
    "narrows a %s slug and rejects every other brand's",
    (brand) => {
      for (const [other, slugs] of Object.entries(SERVICE_SLUGS_BY_BRAND)) {
        for (const slug of slugs) {
          expect(isBrandServiceSlug(brand, slug)).toBe(other === brand);
        }
      }
      expect(isBrandServiceSlug(brand, 'no-such-service')).toBe(false);
    },
  );

  it('gives no slug to two brands', () => {
    const all = Object.values(SERVICE_SLUGS_BY_BRAND).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('SERVICE_LABELS_RU', () => {
  it.each(Object.entries(SERVICE_SLUGS_BY_BRAND))(
    'covers every %s service slug',
    (_brand, slugs) => {
      const missing = slugs.filter((slug) => !(slug in SERVICE_LABELS_RU));
      expect(missing).toEqual([]);
    },
  );

  it('has no label that is only a copy of its slug', () => {
    for (const [slug, label] of Object.entries(SERVICE_LABELS_RU)) {
      expect(label).not.toBe(slug);
    }
  });

  it('holds no slug outside the three brands', () => {
    expect(Object.keys(SERVICE_LABELS_RU).sort()).toEqual(
      [
        ...Object.values(SERVICE_SLUGS_BY_BRAND).flat(),
        ...FORM_ONLY_SLUGS,
        ...LEGACY_SLUGS,
        ...PARTNER_SLUGS,
      ].sort(),
    );
  });

  it('labels the service a lead gets when approved.rs sends it to a sister brand', () => {
    for (const slug of PARTNER_SLUGS) {
      expect(serviceLabel(slug)).not.toBe(slug);
    }
  });

  it('names a partner slug for every brand but approved.rs itself', () => {
    expect(Object.keys(PARTNER_SERVICE).sort()).toEqual(
      Object.keys(BRANDS)
        .filter((key) => key !== 'approved')
        .sort(),
    );
  });

  it('tells a partner slug from a service a brand site offers itself', () => {
    expect(isPartnerService('partner-carlab')).toBe(true);
    expect(isPartnerService('diagnostics')).toBe(false);
  });

  it('names a shop order the way the owner card should read it', () => {
    expect(serviceLabel('parts-order')).toBe('Заказ из магазина');
  });
});
