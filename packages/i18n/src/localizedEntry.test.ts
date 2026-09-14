import { describe, it, expect } from 'vitest';
import {
  localizedEntry,
  publishedByNewest,
  publishedEntries,
} from './localizedEntry.ts';

const entry = {
  body: 'Русский текст',
  data: {
    title: 'Русский заголовок',
    car: 'BMW X3',
    translations: {
      sr: { title: 'Srpski naslov', body: 'Srpski tekst', car: 'BMW X3 (SR)' },
    },
  },
};

describe('localizedEntry', () => {
  it('returns the source for the language the entry is authored in', () => {
    expect(localizedEntry(entry, 'ru')).toEqual({
      title: 'Русский заголовок',
      body: 'Русский текст',
      car: 'BMW X3',
    });
  });

  it('returns the translation when it is complete', () => {
    expect(localizedEntry(entry, 'sr')).toEqual({
      title: 'Srpski naslov',
      body: 'Srpski tekst',
      car: 'BMW X3 (SR)',
    });
  });

  it('falls back to the source when the locale has no translation', () => {
    expect(localizedEntry(entry, 'en').title).toBe('Русский заголовок');
  });

  it('keeps a translated car even when the title or body is empty', () => {
    const half = {
      body: 'Русский текст',
      data: {
        title: 'Русский заголовок',
        car: 'BMW X3',
        translations: { sr: { title: '  ', body: '', car: 'BMW X3 (SR)' } },
      },
    };
    expect(localizedEntry(half, 'sr')).toEqual({
      title: 'Русский заголовок',
      body: 'Русский текст',
      car: 'BMW X3 (SR)',
    });
  });

  it('keeps the source car when the translation leaves it blank', () => {
    const blankCar = {
      body: 'Русский текст',
      data: {
        title: 'Русский заголовок',
        car: 'BMW X3',
        translations: { sr: { title: 'Naslov', body: 'Tekst', car: '  ' } },
      },
    };
    expect(localizedEntry(blankCar, 'sr').car).toBe('BMW X3');
  });

  it('treats a missing body as an empty one', () => {
    expect(
      localizedEntry({ data: { title: 'Только заголовок' } }, 'ru'),
    ).toEqual({ title: 'Только заголовок', body: '', car: undefined });
  });
});

describe('publishedEntries', () => {
  it('drops the unpublished ones and keeps the order', () => {
    const entries = [
      { id: 'a', data: { published: true } },
      { id: 'b', data: { published: false } },
      { id: 'c', data: { published: true } },
    ];
    expect(publishedEntries(entries).map((e) => e.id)).toEqual(['a', 'c']);
  });
});

describe('publishedByNewest', () => {
  const entry = (published: boolean, date: string) => ({
    data: { published, date: new Date(date), title: date },
  });

  it('keeps only published entries, newest first', () => {
    const old = entry(true, '2026-01-01');
    const recent = entry(true, '2026-06-01');
    const draft = entry(false, '2026-12-01');

    expect(publishedByNewest([old, draft, recent])).toEqual([recent, old]);
  });
});
