import { describe, it, expect } from 'vitest';
import { withPlaceholder } from './withPlaceholder.ts';

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
