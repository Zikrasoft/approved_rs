import { describe, it, expect } from 'vitest';
import { getI18n } from './getI18n';

describe('getI18n', () => {
  it('returns the ru dictionary for "ru"', () => {
    expect(getI18n('ru').nav['vehicle-sourcing']).toBe('Автоподбор');
  });

  it('returns a dictionary for "en" and "sr" with the same shape as ru', () => {
    expect(Object.keys(getI18n('en'))).toEqual(Object.keys(getI18n('ru')));
    expect(Object.keys(getI18n('sr'))).toEqual(Object.keys(getI18n('ru')));
  });
});
