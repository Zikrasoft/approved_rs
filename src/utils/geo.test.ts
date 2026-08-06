import { describe, it, expect } from 'vitest';
import {
  getActiveCountries,
  getCountry,
  getCitiesForCountry,
  getCountryFlag,
} from './geo';

describe('getActiveCountries', () => {
  it('returns only active countries', () => {
    const result = getActiveCountries();
    expect(result.every(c => c.active)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getCountry', () => {
  it('returns country by code', () => {
    const result = getCountry('de');
    expect(result?.ru.name).toBe('Германия');
  });

  it('returns undefined for unknown code', () => {
    expect(getCountry('xx')).toBeUndefined();
  });
});

describe('getCitiesForCountry', () => {
  it('returns only cities for given country', () => {
    const result = getCitiesForCountry('de');
    expect(result.every(c => c.country === 'de')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown country', () => {
    expect(getCitiesForCountry('xx')).toEqual([]);
  });
});

describe('getCountryFlag', () => {
  it('returns flag for known country code', () => {
    expect(getCountryFlag('de')).toBe('🇩🇪');
  });

  it('returns fallback flag for unknown code', () => {
    expect(getCountryFlag('xx')).toBe('🏳️');
  });
});

