import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createContent } from './content.ts';
import { createSectionLoader } from './loadSection.ts';

const loadSection = createSectionLoader<'ru' | 'en' | 'de'>();

const homeSchema = z.object({ title: z.string() }).strict();
const navSchema = z.object({ home: z.string() }).strict();

const SECTIONS = [
  {
    key: 'home',
    path: 'src/content/i18n/home.yaml',
    schema: homeSchema,
    promptSubject: 'home',
  },
  {
    key: 'nav',
    path: 'src/content/i18n/nav.yaml',
    schema: navSchema,
    promptSubject: 'nav',
  },
] as const;

const FILES = {
  '/src/content/i18n/home.yaml': `
title: Главная
translations:
  en:
    title: Home
`,
  '/src/content/i18n/nav.yaml': 'home: Домой\n',
};

describe('createContent', () => {
  it('returns every registered section under its key', () => {
    const content = createContent(loadSection, SECTIONS, FILES);

    expect(content('ru')).toEqual({
      home: { title: 'Главная' },
      nav: { home: 'Домой' },
    });
  });

  it('serves a translation and falls back to ru per section', () => {
    const content = createContent(loadSection, SECTIONS, FILES);

    expect(content('en')).toEqual({
      home: { title: 'Home' },
      nav: { home: 'Домой' },
    });
    expect(content('de').home.title).toBe('Главная');
  });

  it('builds each locale once', () => {
    const content = createContent(loadSection, SECTIONS, FILES);

    expect(content('en')).toBe(content('en'));
  });

  it('throws at creation on an invalid ru source', () => {
    expect(() =>
      createContent(loadSection, SECTIONS, {
        ...FILES,
        '/src/content/i18n/nav.yaml': 'home: 1\n',
      }),
    ).toThrow();
  });

  it('throws at creation on a registry path no YAML file matches', () => {
    const homeOnly = {
      '/src/content/i18n/home.yaml': FILES['/src/content/i18n/home.yaml'],
    };

    expect(() => createContent(loadSection, SECTIONS, homeOnly)).toThrow(
      'no YAML file matches the registry path src/content/i18n/nav.yaml',
    );
  });
});
