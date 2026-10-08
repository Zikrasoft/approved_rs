import { describe, expect, it } from 'vitest';
import { productType } from '@podbor/shop-catalog/browser';
import { formatSpec, optionLabel, specCopy } from './formatSpec';
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

const batteries = productType('batteries')!;
const copy = specCopy(content('ru').shop, 'batteries', 'ru-RS');

describe('formatSpec', () => {
  it('shows only the card fields on a card, labelled and with units', () => {
    expect(formatSpec(batteries, SPEC, copy, 'card')).toEqual([
      { key: 'brand', label: 'Бренд', value: 'Bosch' },
      { key: 'capacityAh', label: 'Ёмкость', value: '60 А·ч' },
      { key: 'crankingA', label: 'Пусковой ток', value: '540 А' },
      { key: 'polarity', label: 'Полярность', value: 'обратная (минус слева)' },
    ]);
  });

  it('shows every field the product has on its page, in registry order, skipping missing ones', () => {
    expect(formatSpec(batteries, SPEC, copy).map((line) => line.key)).toEqual([
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

  it('formats decimals for the reader and joins code lists', () => {
    const oils = productType('motor-oils')!;
    const lines = formatSpec(
      oils,
      {
        brand: 'Castrol',
        viscosity: '5w-30',
        volumeL: 4.5,
        base: 'synthetic',
        approvals: ['VW 504.00', 'MB 229.51'],
      },
      specCopy(content('ru').shop, 'motor-oils', 'ru-RS'),
    );
    expect(Object.fromEntries(lines.map((l) => [l.key, l.value]))).toEqual({
      brand: 'Castrol',
      viscosity: '5W-30',
      volumeL: '4,5 л',
      base: 'синтетическое',
      approvals: 'VW 504.00, MB 229.51',
    });
  });
});

describe('optionLabel', () => {
  it('names booleans and passes codes through', () => {
    const flag = { kind: 'boolean', key: 'x', label: 'x' } as const;
    expect(optionLabel(flag, 'true', copy)).toBe('Да');
    expect(optionLabel(flag, 'false', copy)).toBe('Нет');
    expect(optionLabel(batteries.fields[0], 'Varta', copy)).toBe('Varta');
  });
});
