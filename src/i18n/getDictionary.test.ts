import { describe, it, expect } from 'vitest';
import { getDictionary } from './getDictionary';

describe('getDictionary', () => {
  it('returns the ru dictionary for "ru"', () => {
    expect(getDictionary('ru').nav.autopodbor).toBe('Автоподбор');
  });

  it('returns a dictionary for "en" and "sr" with the same shape as ru', () => {
    expect(Object.keys(getDictionary('en'))).toEqual(Object.keys(getDictionary('ru')));
    expect(Object.keys(getDictionary('sr'))).toEqual(Object.keys(getDictionary('ru')));
  });
});
