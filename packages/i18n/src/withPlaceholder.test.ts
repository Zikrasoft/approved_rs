import { describe, it, expect } from 'vitest';
import { placeholderDiff, withPlaceholder } from './withPlaceholder.ts';

describe('withPlaceholder', () => {
  it('substitutes a token', () => {
    expect(withPlaceholder('Подбор в {city}', 'city', 'Белграде')).toBe(
      'Подбор в Белграде',
    );
  });

  it('replaces every occurrence, not just the first', () => {
    expect(withPlaceholder('{x} и ещё {x}', 'x', 'раз')).toBe('раз и ещё раз');
  });

  it('leaves text without the token untouched', () => {
    expect(withPlaceholder('Без токена', 'city', 'Белград')).toBe('Без токена');
  });
});

describe('placeholderDiff', () => {
  it('names the tokens a translation dropped and the ones it invented', () => {
    expect(placeholderDiff('{count} in {city}', 'u {city} {price}')).toEqual({
      dropped: ['{count}'],
      invented: ['{price}'],
    });
  });

  it('finds nothing when both carry the same tokens in any order', () => {
    expect(placeholderDiff('{a} {b} {a}', '{b} {a}')).toEqual({
      dropped: [],
      invented: [],
    });
  });
});
