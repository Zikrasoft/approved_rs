import { describe, expect, it } from 'vitest';
import { normalizePartNumber, partPageSlug } from './partNumber.ts';

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
