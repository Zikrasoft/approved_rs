import { describe, it, expect } from 'vitest';
import { SERVICE_LABELS_RU, serviceLabel } from './serviceLabels.ts';

const APPROVED_SLUGS = [
  'vehicle-sourcing',
  'vehicle-buyback',
  'vehicle-inspection',
  'vehicle-import',
  'vehicle-import-de',
  'vehicle-import-es',
  'vehicle-import-ch',
  'vehicle-import-eu',
  'vehicle-import-china',
];

const CARLAB_SLUGS = [
  'diagnostics',
  'servicing',
  'brakes-suspension',
  'engine-gearbox',
  'bodywork-painting',
  'pre-purchase-inspection',
  'parts-order',
];

const DETAILS_SLUGS = [
  'paint-protection-film',
  'colour-change-wrap',
  'polishing-ceramic',
  'steering-wheel-restoration',
];

// Retired approved.rs slugs that still sit on stored leads.
const LEGACY_SLUGS = ['auto-service-belgrade', 'detailing-belgrade'];

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

describe('SERVICE_LABELS_RU', () => {
  it.each([
    ['approved.rs', APPROVED_SLUGS],
    ['CarLab', CARLAB_SLUGS],
    ['Details', DETAILS_SLUGS],
  ])('covers every %s service slug', (_brand, slugs) => {
    const missing = slugs.filter((slug) => !(slug in SERVICE_LABELS_RU));
    expect(missing).toEqual([]);
  });

  it('has no label that is only a copy of its slug', () => {
    for (const [slug, label] of Object.entries(SERVICE_LABELS_RU)) {
      expect(label).not.toBe(slug);
    }
  });

  it('holds no slug outside the three brands', () => {
    expect(Object.keys(SERVICE_LABELS_RU).sort()).toEqual(
      [
        ...APPROVED_SLUGS,
        ...CARLAB_SLUGS,
        ...DETAILS_SLUGS,
        ...LEGACY_SLUGS,
      ].sort(),
    );
  });
});
