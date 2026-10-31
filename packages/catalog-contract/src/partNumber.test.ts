import { describe, expect, it } from 'vitest';
import {
  normalizePartNumber,
  partNumberQuery,
  partPageSlug,
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
