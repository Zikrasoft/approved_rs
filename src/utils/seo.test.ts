import { describe, it, expect } from 'vitest';
import { generateMeta } from './seo';

const de = { name: 'Германия', nameGenitive: 'Германии', nameLocative: 'Германии' };
const rs = { name: 'Сербия', nameGenitive: 'Сербии', nameLocative: 'Сербии', nameAccusative: 'Сербию' };
const berlin = { name: 'Берлин', nameLocative: 'Берлине' };

describe('generateMeta', () => {
  it('generates autopodbor meta for country', () => {
    const meta = generateMeta('autopodbor', { country: de, baseUrl: 'https://approved.rs', path: '/de/autopodbor/' });
    expect(meta.title).toContain('Германии');
    expect(meta.title).toContain('Автоподбор');
    expect(meta.canonical).toBe('https://approved.rs/de/autopodbor/');
  });

  it('generates autopodbor meta for city', () => {
    const meta = generateMeta('autopodbor', { country: de, city: berlin, baseUrl: 'https://approved.rs', path: '/de/berlin/autopodbor/' });
    expect(meta.title).toContain('Берлине');
  });

  it('generates delivery meta for route', () => {
    const meta = generateMeta('delivery', { fromCountry: de, toCountry: rs, baseUrl: 'https://approved.rs', path: '/dostavka/de-rs/' });
    expect(meta.title).toContain('Германии');
    expect(meta.title).toContain('Сербию');
  });

  it('generates vykup meta', () => {
    const meta = generateMeta('vykup', { country: de, baseUrl: 'https://approved.rs', path: '/de/vykup/' });
    expect(meta.title).toContain('Выкуп');
    expect(meta.description.length).toBeGreaterThan(50);
  });
});
