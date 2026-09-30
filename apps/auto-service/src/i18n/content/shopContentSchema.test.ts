import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { withPlaceholder } from '@podbor/i18n';
import { PRODUCT_TYPES } from '@podbor/shop-catalog/browser';
import shopYaml from '@/content/i18n/shop.yaml?raw';
import {
  INSTALLATION_HANDLES,
  SHOP_UNITS,
  shopContentSchema,
  type ShopContent,
} from './shopContentSchema';

const russian = (): ShopContent => {
  const raw = parse(shopYaml) as Record<string, unknown>;
  delete raw.translations;
  delete raw.translatedFrom;
  return raw as unknown as ShopContent;
};

describe('shopContentSchema', () => {
  it('accepts the Russian copy', () => {
    expect(shopContentSchema.safeParse(russian()).success).toBe(true);
  });

  it('takes its units and installations from the registry', () => {
    expect(SHOP_UNITS).toEqual(['Ah', 'A', 'mm', 'months', 'l']);
    expect(INSTALLATION_HANDLES).toEqual([
      'battery-installation',
      'brake-installation',
    ]);
  });

  it('has copy for every type, field and enum value the registry defines', () => {
    const copy = shopContentSchema.parse(russian());
    for (const type of PRODUCT_TYPES) {
      for (const field of type.fields) {
        expect(copy.types[type.key].fields[field.key].label).not.toBe('');
        if (field.kind === 'enum')
          for (const option of field.values)
            expect(
              copy.types[type.key].fields[field.key].values?.[option.value],
            ).toBeTruthy();
      }
    }
  });

  it.each<[string, (raw: ShopContent) => void]>([
    [
      'an enum value',
      (raw) => {
        delete raw.types.batteries.fields.polarity.values!.left;
      },
    ],
    [
      'a field',
      (raw) => {
        delete raw.types['motor-oils'].fields.viscosity;
      },
    ],
    [
      'a type',
      (raw) => {
        delete raw.types.brakes;
      },
    ],
    [
      "a type's landing lead",
      (raw) => {
        delete (raw.types.batteries.landing as { lead?: string }).lead;
      },
    ],
    [
      'a unit',
      (raw) => {
        delete raw.units.Ah;
      },
    ],
    [
      'an installation',
      (raw) => {
        delete raw.installations['battery-installation'];
      },
    ],
  ])('fails loudly when %s has no copy', (_label, drop) => {
    const raw = russian();
    drop(raw);
    expect(shopContentSchema.safeParse(raw).success).toBe(false);
  });

  it('gives every landing its own lead, distinct from the type lead', () => {
    const copy = shopContentSchema.parse(russian());
    for (const type of PRODUCT_TYPES) {
      const typeCopy = copy.types[type.key];
      expect(typeCopy.landing.lead).not.toBe(typeCopy.lead);
      const filled = withPlaceholder(typeCopy.landing.lead, 'value', '60 А·ч');
      expect(filled).toContain('60 А·ч');
      expect(filled).not.toBe(typeCopy.landing.lead);
    }
  });

  it('refuses copy for a field the registry does not have', () => {
    const raw = russian();
    raw.types.batteries.fields.colour = { label: 'Цвет' };
    expect(shopContentSchema.safeParse(raw).success).toBe(false);
  });
});
