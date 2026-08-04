import { describe, it, expect } from 'vitest';
import { generateMeta } from './seo';
import type { Country, City } from './geo';

const de: Country = {
  code: 'de',
  ru: { name: 'Германия', nameGenitive: 'Германии', nameLocative: 'Германии', nameAccusative: 'Германию' },
  en: { name: 'Germany' },
  sr: { name: 'Nemačka', nameGenitive: 'Nemačke', nameLocative: 'Nemačkoj', nameAccusative: 'Nemačku' },
  active: true,
};
const berlin: City = {
  slug: 'berlin',
  ru: { name: 'Берлин', nameLocative: 'Берлине' },
  en: { name: 'Berlin' },
  sr: { name: 'Berlin', nameLocative: 'Berlinu' },
  country: 'de',
  active: true,
};

describe('generateMeta', () => {
  it('generates autopodbor meta for country', () => {
    const meta = generateMeta('autopodbor', { country: de, baseUrl: 'https://approved.rs', path: '/de/autopodbor/', locale: 'ru' });
    expect(meta.title).toContain('Германии');
    expect(meta.title).toContain('Автоподбор');
    expect(meta.canonical).toBe('https://approved.rs/de/autopodbor/');
  });

  it('generates autopodbor meta for city', () => {
    const meta = generateMeta('autopodbor', { country: de, city: berlin, baseUrl: 'https://approved.rs', path: '/de/berlin/autopodbor/', locale: 'ru' });
    expect(meta.title).toContain('Берлине');
  });

  it('generates vykup meta', () => {
    const meta = generateMeta('vykup', { country: de, baseUrl: 'https://approved.rs', path: '/de/vykup/', locale: 'ru' });
    expect(meta.title).toContain('Выкуп');
    expect(meta.description.length).toBeGreaterThan(50);
  });
});
