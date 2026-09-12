import { describe, it, expect } from 'vitest';
import { assertSafeTranslation } from './assertSafeTranslation';

describe('assertSafeTranslation', () => {
  it('does not throw for a matching, safe translation', () => {
    expect(() =>
      assertSafeTranslation(
        { title: 'Заголовок', items: ['а', 'б'] },
        { title: 'Title', items: ['a', 'b'] },
        '',
      ),
    ).not.toThrow();
  });

  it('throws when a string leaf is missing from the response entirely', () => {
    expect(() => assertSafeTranslation({ title: 'Заголовок' }, {}, '')).toThrow(
      /title/,
    );
  });

  it('throws when an array is shorter than the source (a truncated translation)', () => {
    expect(() =>
      assertSafeTranslation({ general: [1, 2, 3] }, { general: [1] }, ''),
    ).toThrow(/general/);
  });

  it('throws when a translated string contains raw HTML', () => {
    expect(() =>
      assertSafeTranslation(
        { homeLabel: 'Главная' },
        { homeLabel: '<script>alert(1)</script>' },
        '',
      ),
    ).toThrow(/homeLabel/);
  });

  it('does not throw when the source already had the same kind of HTML (e.g. a case body with a deliberate <ul class="icon-pin"> list)', () => {
    expect(() =>
      assertSafeTranslation(
        { body: '<ul class="icon-pin"><li>Белград</li></ul>' },
        { body: '<ul class="icon-pin"><li>Belgrade</li></ul>' },
        '',
      ),
    ).not.toThrow();
  });

  it('still throws when the translation introduces HTML the source never had', () => {
    expect(() =>
      assertSafeTranslation(
        { body: 'Обычный текст без разметки.' },
        { body: '<img src=x onerror=alert(1)>' },
        '',
      ),
    ).toThrow(/body/);
  });

  it('recurses into nested objects and arrays of objects, producing a path-qualified error', () => {
    expect(() =>
      assertSafeTranslation(
        { general: [{ q: 'Вопрос?', a: 'Ответ.' }] },
        { general: [{ q: 'Q?', a: '<img src=x onerror=alert(1)>' }] },
        '',
      ),
    ).toThrow('general[0].a');
  });

  it('handles a bare object with no array wrapper (case-shaped {title, body})', () => {
    expect(() =>
      assertSafeTranslation(
        { title: 'Заголовок', body: 'Текст' },
        { title: 'Title', body: 'Text' },
        '',
      ),
    ).not.toThrow();

    expect(() =>
      assertSafeTranslation(
        { title: 'Заголовок', body: 'Текст' },
        { title: 'Title', body: '<img src=x onerror=alert(1)>' },
        '',
      ),
    ).toThrow('body');
  });
});
