import { describe, expect, it } from 'vitest';
import { productType } from '@podbor/shop-catalog/browser';
import { filterDef, typeView } from './typeView';
import { content } from '@/i18n/content';

const SPEC = {
  brand: 'Bosch',
  capacityAh: 60,
  crankingA: 540,
  polarity: 'left',
  lengthMm: 242,
  widthMm: 175,
  heightMm: 175,
  warrantyMonths: 24,
};

const OIL = {
  brand: 'Castrol',
  viscosity: '5w-30',
  volumeL: 4.5,
  base: 'synthetic',
  approvals: ['VW 504.00', 'MB 229.51'],
};

const batteries = typeView('batteries', 'ru');

describe('typeView', () => {
  it('resolves a URL key and a resolved type to the same memoised view', () => {
    expect(typeView(productType('batteries')!, 'ru')).toBe(batteries);
    expect(batteries.type).toBe(productType('batteries'));
  });

  it('throws one clear error for an unknown type key', () => {
    expect(() => typeView('tyres', 'ru')).toThrow(
      '[shop] unknown product type "tyres"',
    );
  });

  it('throws one clear error for an unknown field key', () => {
    const unknown = '[shop] product type "batteries" has no field "colour"';
    expect(() => batteries.field('colour')).toThrow(unknown);
    expect(() => batteries.label('colour')).toThrow(unknown);
    expect(() => batteries.formatValue('colour', 'red')).toThrow(unknown);
  });

  it('carries the locale copy of the type', () => {
    expect(typeView('batteries', 'en').copy).toBe(
      content('en').shop.types.batteries,
    );
    expect(batteries.copy.name).toBe('Аккумуляторы');
    expect(batteries.label('capacityAh')).toBe('Ёмкость');
    expect(batteries.unit('capacityAh')).toBe('А·ч');
    expect(batteries.unit('brand')).toBe('');
  });

  it('shows only the card fields on a card, labelled and with units', () => {
    expect(batteries.specLines(SPEC, 'card')).toEqual([
      { key: 'brand', label: 'Бренд', value: 'Bosch' },
      { key: 'capacityAh', label: 'Ёмкость', value: '60 А·ч' },
      { key: 'crankingA', label: 'Пусковой ток', value: '540 А' },
      { key: 'polarity', label: 'Полярность', value: 'обратная (минус слева)' },
    ]);
  });

  it('shows every field the product has on its page, in registry order, skipping missing ones', () => {
    expect(batteries.specLines(SPEC).map((line) => line.key)).toEqual([
      'brand',
      'capacityAh',
      'crankingA',
      'polarity',
      'lengthMm',
      'widthMm',
      'heightMm',
      'warrantyMonths',
    ]);
  });

  it('formats each field kind for the reader', () => {
    const lines = typeView('motor-oils', 'ru').specLines(OIL);
    expect(Object.fromEntries(lines.map((l) => [l.key, l.value]))).toEqual({
      brand: 'Castrol',
      viscosity: '5W-30',
      volumeL: '4,5 л',
      base: 'синтетическое',
      approvals: 'VW 504.00, MB 229.51',
    });
  });

  it('formats numbers in the locale of the view', () => {
    expect(typeView('motor-oils', 'en').formatValue('volumeL', 4.5)).toMatch(
      /^4\.5 /,
    );
  });

  it('names booleans and passes codes through', () => {
    const flagged = typeView(
      {
        key: 'flags',
        label: 'x',
        fitment: 'none',
        fields: [{ kind: 'boolean', key: 'flag', label: 'x' }],
      },
      'sr',
    );
    expect(flagged.optionLabel('flag', 'true')).toBe(
      content('sr').shop.booleanYes,
    );
    expect(flagged.optionLabel('flag', 'false')).toBe(
      content('sr').shop.booleanNo,
    );
    expect(batteries.optionLabel('brand', 'Varta')).toBe('Varta');
  });

  it('lists the facets of a set of products, leaving one out on request', () => {
    const keys = (omit?: string) =>
      batteries.facets([SPEC], omit).map((facet) => facet.key);
    expect(keys()).toEqual(['brand', 'capacityAh', 'crankingA', 'polarity']);
    expect(keys('capacityAh')).toEqual(['brand', 'crankingA', 'polarity']);
  });
});

describe('filterDef', () => {
  it('keeps only what the client filter reads, without any copy', () => {
    expect(filterDef(productType('filters')!)).toEqual({
      fitment: 'required',
      fields: [
        { key: 'brand', kind: 'codes', facet: true },
        {
          key: 'filterKind',
          kind: 'enum',
          facet: true,
          values: [
            { value: 'oil' },
            { value: 'air' },
            { value: 'cabin' },
            { value: 'fuel' },
          ],
        },
      ],
    });
  });
});
