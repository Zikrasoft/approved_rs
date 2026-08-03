import { describe, it, expect } from 'vitest';
import { withLocales } from './paths';

describe('withLocales', () => {
  it('crosses each input path with every supported locale', () => {
    const result = withLocales([{ params: { country: 'de' } }, { params: { country: 'rs' } }]);
    expect(result).toEqual([
      { params: { locale: 'ru', country: 'de' } },
      { params: { locale: 'ru', country: 'rs' } },
      { params: { locale: 'en', country: 'de' } },
      { params: { locale: 'en', country: 'rs' } },
      { params: { locale: 'sr', country: 'de' } },
      { params: { locale: 'sr', country: 'rs' } },
    ]);
  });

  it('preserves props alongside params', () => {
    const result = withLocales([{ params: {}, props: { foo: 'bar' } }]);
    expect(result.every(p => p.props?.foo === 'bar')).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('handles a single empty-params entry (page with no other dynamic segments)', () => {
    expect(withLocales([{ params: {} }])).toEqual([
      { params: { locale: 'ru' } },
      { params: { locale: 'en' } },
      { params: { locale: 'sr' } },
    ]);
  });
});
