import { describe, expect, it } from 'vitest';
import { cacheKey } from './cacheKey';

describe('cacheKey', () => {
  it('gives the same data the same key', () => {
    expect(cacheKey({ a: [1, 2], b: new Set(['y', 'x']) })).toBe(
      cacheKey({ a: [1, 2], b: new Set(['x', 'y']) }),
    );
  });

  it('gives changed data a new key', () => {
    expect(cacheKey({ price: 100 })).not.toBe(cacheKey({ price: 120 }));
  });

  it('reads through Maps and Sets', () => {
    expect(cacheKey(new Map([['a', 1]]))).not.toBe(
      cacheKey(new Map([['a', 2]])),
    );
    expect(cacheKey(new Set(['a']))).not.toBe(cacheKey(new Set(['b'])));
  });
});
