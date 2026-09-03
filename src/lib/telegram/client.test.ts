import { describe, it, expect } from 'vitest';
import { parseIds } from './client';

describe('parseIds', () => {
  it('parses a single id', () => {
    expect(parseIds('111')).toEqual([111]);
  });

  it('parses comma-separated ids — someone can have more than one Telegram account', () => {
    expect(parseIds('111,333')).toEqual([111, 333]);
  });

  it('trims whitespace around each id', () => {
    expect(parseIds(' 111 , 333 ')).toEqual([111, 333]);
  });

  it('returns an empty array for undefined or empty input', () => {
    expect(parseIds(undefined)).toEqual([]);
    expect(parseIds('')).toEqual([]);
  });

  it('drops non-numeric entries instead of producing NaN', () => {
    expect(parseIds('111,,abc,333')).toEqual([111, 333]);
  });
});
