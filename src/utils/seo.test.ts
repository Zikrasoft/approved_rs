import { describe, it, expect } from 'vitest';
import { generateMeta, buildLocation, excerptFromMarkdown } from './seo';
import type { Country, City } from './geo';

const de: Country = {
  code: 'de',
  ru: {
    name: 'Германия',
    nameGenitive: 'Германии',
    nameLocative: 'Германии',
    nameAccusative: 'Германию',
  },
  en: { name: 'Germany' },
  sr: {
    name: 'Nemačka',
    nameGenitive: 'Nemačke',
    nameLocative: 'Nemačkoj',
    nameAccusative: 'Nemačku',
  },
  es: { name: 'Alemania' },
  de: { name: 'Deutschland' },
  active: true,
};
const berlin: City = {
  slug: 'berlin',
  ru: { name: 'Берлин', nameLocative: 'Берлине' },
  en: { name: 'Berlin' },
  sr: { name: 'Berlin', nameLocative: 'Berlinu' },
  es: { name: 'Berlín' },
  de: { name: 'Berlin' },
  country: 'de',
  active: true,
};

describe('generateMeta', () => {
  it('generates vehicle-sourcing meta for country', () => {
    const meta = generateMeta('vehicle-sourcing', {
      country: de,
      baseUrl: 'https://approved.rs',
      path: '/vehicle-sourcing/de/',
      locale: 'ru',
    });
    expect(meta.title).toContain('Германии');
    expect(meta.title).toContain('Автоподбор');
    expect(meta.canonical).toBe('https://approved.rs/vehicle-sourcing/de/');
  });

  it('generates vehicle-sourcing meta for city', () => {
    const meta = generateMeta('vehicle-sourcing', {
      country: de,
      city: berlin,
      baseUrl: 'https://approved.rs',
      path: '/vehicle-sourcing/de/berlin/',
      locale: 'ru',
    });
    expect(meta.title).toContain('Берлине');
  });

  it('generates vehicle-buyback meta', () => {
    const meta = generateMeta('vehicle-buyback', {
      country: de,
      baseUrl: 'https://approved.rs',
      path: '/vehicle-buyback/de/',
      locale: 'ru',
    });
    expect(meta.title).toContain('Выкуп');
    expect(meta.description.length).toBeGreaterThan(50);
  });
});

describe('excerptFromMarkdown', () => {
  it('strips bold/italic/code markers', () => {
    expect(
      excerptFromMarkdown('**Клиент** обратился за _подбором_ авто.'),
    ).toBe('Клиент обратился за подбором авто.');
  });

  it('strips a markdown link down to its link text', () => {
    expect(
      excerptFromMarkdown(
        'Мы подобрали [BMW X5](https://example.com) для клиента.',
      ),
    ).toBe('Мы подобрали BMW X5 для клиента.');
  });

  it('takes only the first paragraph', () => {
    expect(excerptFromMarkdown('Первый абзац.\n\nВторой абзац.')).toBe(
      'Первый абзац.',
    );
  });

  it('truncates on a word boundary and appends an ellipsis past maxLen', () => {
    const long = 'Слово '.repeat(30).trim();
    const result = excerptFromMarkdown(long, 20);
    expect(result.length).toBeLessThanOrEqual(21);
    expect(result.endsWith('…')).toBe(true);
    // every word before the ellipsis is one of the whole repeated "Слово"
    // words — cutting mid-word would leave a partial, differently-sized one
    const words = result.slice(0, -1).trim().split(' ');
    expect(words.every((w) => w === 'Слово')).toBe(true);
  });

  it('returns the text unchanged when shorter than maxLen', () => {
    expect(excerptFromMarkdown('Короткий текст.', 140)).toBe('Короткий текст.');
  });
});

describe('buildLocation', () => {
  it('uses the Slavic locative case + preposition for ru/sr', () => {
    expect(buildLocation('ru', de)).toBe('в Германии');
    expect(buildLocation('sr', de)).toBe('u Nemačkoj');
  });

  it('uses a plain preposition + name for en/es/de (no case declension)', () => {
    expect(buildLocation('en', de)).toBe('in Germany');
    expect(buildLocation('es', de)).toBe('en Alemania');
    expect(buildLocation('de', de)).toBe('in Deutschland');
  });

  it('prefers the city over the country when both are given', () => {
    expect(buildLocation('es', de, berlin)).toBe('en Berlín');
    expect(buildLocation('ru', de, berlin)).toBe('в Берлине');
  });
});
