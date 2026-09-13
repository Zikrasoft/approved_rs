import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createSectionLoader } from './loadSection.ts';

const loadSection = createSectionLoader<'ru' | 'en' | 'sr' | 'de'>();

const schema = z.object({
  title: z.string(),
  cta: z.string(),
});

const yaml = `
title: Автоподбор
cta: Оставить заявку
translations:
  en:
    title: Vehicle sourcing
    cta: Request a call
  sr:
    title: Izbor vozila
    cta: Pošaljite zahtev
`;

describe('loadSection', () => {
  it('returns the source language as written', () => {
    const get = loadSection(schema, yaml);

    expect(get('ru')).toEqual({
      title: 'Автоподбор',
      cta: 'Оставить заявку',
    });
  });

  it('returns a translation when one exists', () => {
    const get = loadSection(schema, yaml);

    expect(get('en').title).toBe('Vehicle sourcing');
  });

  it('falls back to the source language for a locale with no translation', () => {
    const get = loadSection(schema, yaml);

    expect(get('de')).toEqual(get('ru'));
  });

  it('inherits only the keys a translation is missing', () => {
    const get = loadSection(
      schema,
      `
title: Автоподбор
cta: Оставить заявку
translations:
  en:
    title: Vehicle sourcing
`,
    );

    expect(get('en')).toEqual({
      title: 'Vehicle sourcing',
      cta: 'Оставить заявку',
    });
  });

  it('names the inherited keys in the build log', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loadSection(
      schema,
      `
title: Автоподбор
cta: Оставить заявку
translations:
  en:
    title: Vehicle sourcing
`,
    );

    expect(warn).toHaveBeenCalledWith(
      '[i18n] en: inheriting source values for',
      'cta',
    );
    warn.mockRestore();
  });

  it('stays quiet about a complete translation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loadSection(schema, yaml);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('inherits only the missing leaf of a nested object', () => {
    const nested = z.object({
      hero: z.object({ title: z.string(), subtitle: z.string() }),
      cta: z.string(),
    });
    const get = loadSection(
      nested,
      `
hero:
  title: Заголовок
  subtitle: Подзаголовок
cta: Заявка
translations:
  en:
    hero:
      title: Heading
    cta: Request
`,
    );

    expect(get('en')).toEqual({
      hero: { title: 'Heading', subtitle: 'Подзаголовок' },
      cta: 'Request',
    });
  });

  it('takes a translated array whole instead of merging element by element', () => {
    const listed = z.object({ steps: z.array(z.string()) });
    const get = loadSection(
      listed,
      `
steps:
  - Первый
  - Второй
  - Третий
translations:
  en:
    steps:
      - One
      - Two
`,
    );

    expect(get('en')).toEqual({ steps: ['One', 'Two'] });
  });

  it('falls back to the source array when the translation omits it', () => {
    const listed = z.object({ steps: z.array(z.string()), cta: z.string() });
    const get = loadSection(
      listed,
      `
steps:
  - Первый
  - Второй
cta: Заявка
translations:
  en:
    cta: Request
`,
    );

    expect(get('en')).toEqual({ steps: ['Первый', 'Второй'], cta: 'Request' });
  });

  it('falls back for a translation whose value has the wrong type', () => {
    const get = loadSection(
      schema,
      `
title: Автоподбор
cta: Оставить заявку
translations:
  en:
    title:
      - Vehicle sourcing
    cta: Request a call
`,
    );

    expect(get('en')).toEqual(get('ru'));
  });

  it('keeps an optional key the translation deliberately leaves out', () => {
    const plural = z.object({
      count: z.object({
        one: z.string(),
        few: z.string().optional(),
        other: z.string(),
      }),
    });
    const get = loadSection(
      plural,
      `
count:
  one: '{count} аккумулятор'
  few: '{count} аккумулятора'
  other: '{count} аккумуляторов'
translations:
  en:
    count:
      one: '{count} battery'
      other: '{count} batteries'
`,
    );

    expect(get('en')).toEqual({
      count: { one: '{count} battery', other: '{count} batteries' },
    });
  });

  it('leaves a complete translation exactly as written', () => {
    const get = loadSection(schema, yaml);

    expect(get('en')).toEqual({
      title: 'Vehicle sourcing',
      cta: 'Request a call',
    });
    expect(get('sr')).toEqual({
      title: 'Izbor vozila',
      cta: 'Pošaljite zahtev',
    });
  });

  it('handles a file with no translations block at all', () => {
    const get = loadSection(schema, 'title: Только RU\ncta: Заявка\n');

    expect(get('en').title).toBe('Только RU');
  });

  it('throws at load time when the source language itself is invalid', () => {
    expect(() => loadSection(schema, 'title: Есть\n')).toThrow();
  });

  it('ignores keys the schema does not declare', () => {
    const get = loadSection(
      schema,
      'title: T\ncta: C\ntranslatedFrom: abc123\n',
    );

    expect(get('ru')).toEqual({ title: 'T', cta: 'C' });
  });

  it('does not resolve inherited object properties as translations', () => {
    const get = loadSection(schema, yaml);

    expect(get('constructor' as 'en')).toEqual(get('ru'));
  });
});
