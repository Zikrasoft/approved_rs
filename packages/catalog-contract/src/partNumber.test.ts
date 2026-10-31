import { describe, expect, it } from 'vitest';
import {
  normalizePartNumber,
  partNumberQuery,
  partPageSlug,
  orderLineTitle,
  partTitle,
} from './partNumber.ts';

describe('normalizePartNumber', () => {
  it.each([
    ['11 42 8575211', '11428575211'],
    ['11-42-857.52/11', '11428575211'],
    ['hu 816 x', 'HU816X'],
    ['  HU816X\t', 'HU816X'],
  ])('reads %j as %j', (raw, normalized) => {
    expect(normalizePartNumber(raw)).toBe(normalized);
  });
});

describe('partPageSlug', () => {
  it('joins the Brand slug and the lower-cased normalized number', () => {
    expect(partPageSlug('mann-filter', 'HU816X')).toBe('mann-filter-hu816x');
  });
});

describe('partNumberQuery', () => {
  it.each([
    ['11 42 8 507 683', '11428507683'],
    ['hu  816-x', 'HU816X'],
    ['W-712/66', 'W71266'],
    ['0 986 494 104', '0986494104'],
  ])('reads %j as the number %j', (raw, number) => {
    expect(partNumberQuery(raw)).toBe(number);
  });

  it.each([
    'масляный фильтр',
    'bmw 11428575211',
    'фильтр 816',
    '5w-30',
    '10W-40',
    '12V 80Ah',
    'x5',
    '',
  ])('reads %j as words, not a number', (raw) => {
    expect(partNumberQuery(raw)).toBeNull();
  });
});

describe('partTitle', () => {
  const mann = { brand: 'Mann-Filter', number: 'HU 816 x' };

  it.each([
    [
      {
        brand: 'Brembo',
        number: 'P 06 087',
        name: 'Тормозные колодки задние Brembo P 06 087',
      },
      { name: 'Тормозные колодки задние', number: 'Brembo P 06 087' },
    ],
    [
      { ...mann, name: 'Масляный фильтр MANN-FILTER HU816x' },
      { name: 'Масляный фильтр', number: 'Mann-Filter HU 816 x' },
    ],
    [
      { brand: 'MANN', number: 'W 712/75', name: 'Фильтр W712/75' },
      { name: 'Фильтр', number: 'MANN W 712/75' },
    ],
    [
      { brand: 'VARTA', number: '580 901 080', name: 'Аккумулятор' },
      { name: 'Аккумулятор', number: 'VARTA 580 901 080' },
    ],
    [
      { ...mann, name: 'Mann-Filter HU 816 x' },
      { name: 'Mann-Filter HU 816 x', number: null },
    ],
    [
      { ...mann, name: 'Фильтр HU816x масляный' },
      { name: 'Фильтр HU816x масляный', number: null },
    ],
  ])('splits %j', (part, title) => {
    expect(partTitle(part)).toEqual(title);
  });
});

describe('orderLineTitle', () => {
  it('brackets the brand and number after the name', () => {
    expect(
      orderLineTitle({
        brand: 'MANN-FILTER',
        number: 'W 712/66',
        name: 'Масляный фильтр MANN-FILTER W 712/66',
      }),
    ).toBe('Масляный фильтр (MANN-FILTER W 712/66)');
  });

  it('keeps a name that already carries the number', () => {
    expect(
      orderLineTitle({
        brand: 'Mann-Filter',
        number: 'HU 816 x',
        name: 'Mann-Filter HU 816 x',
      }),
    ).toBe('Mann-Filter HU 816 x');
  });
});
