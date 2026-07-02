import { describe, it, expect } from 'vitest';
import {
  getActiveCountries,
  getCountry,
  getCitiesForCountry,
  getActiveRoutes,
  getRoute,
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
    expect(result?.name).toBe('Германия');
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

describe('getActiveRoutes', () => {
  it('returns only active routes', () => {
    const result = getActiveRoutes();
    expect(result.every(r => r.active)).toBe(true);
  });
});

describe('getRoute', () => {
  it('parses slug and finds route', () => {
    const result = getRoute('de-rs');
    expect(result?.from).toBe('de');
    expect(result?.to).toBe('rs');
  });

  it('returns undefined for unknown route', () => {
    expect(getRoute('xx-yy')).toBeUndefined();
  });
});
