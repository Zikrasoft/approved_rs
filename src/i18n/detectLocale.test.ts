import { describe, it, expect } from 'vitest';
import { detectLocale } from './detectLocale';

describe('detectLocale', () => {
  it('prefers a valid cookie value over Accept-Language', () => {
    expect(detectLocale('en-US,en;q=0.9', 'sr')).toBe('sr');
  });

  it('ignores an invalid/unsupported cookie value', () => {
    expect(detectLocale('en-US,en;q=0.9', 'fr')).toBe('en');
  });

  it('picks the highest-weighted supported language from Accept-Language', () => {
    expect(detectLocale('fr-FR;q=0.9,en;q=0.8,ru;q=0.7', undefined)).toBe('en');
  });

  it('matches on the primary subtag (en-GB matches en)', () => {
    expect(detectLocale('en-GB', undefined)).toBe('en');
  });

  it('falls back to the default locale when nothing matches', () => {
    expect(detectLocale('fr-FR,de-DE', undefined)).toBe('ru');
  });

  it('falls back to the default locale when there is no header and no cookie', () => {
    expect(detectLocale(null, undefined)).toBe('ru');
  });
});
