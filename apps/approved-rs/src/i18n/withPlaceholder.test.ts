import { describe, it, expect } from 'vitest';
import { withPlaceholder } from './withPlaceholder';

describe('withPlaceholder', () => {
  it('replaces the token with the value', () => {
    expect(withPlaceholder('Hello {name}', 'name', 'World')).toBe(
      'Hello World',
    );
  });

  it('replaces every occurrence of the token, not just the first', () => {
    expect(withPlaceholder('{name}, meet {name}', 'name', 'Bob')).toBe(
      'Bob, meet Bob',
    );
  });

  it('leaves the text unchanged when the token is absent', () => {
    expect(withPlaceholder('Hello there', 'name', 'World')).toBe('Hello there');
  });
});
