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

  it('throws when the translation smuggles a new tag into a body that already had markup', () => {
    expect(() =>
      assertSafeTranslation(
        { body: '<ul class="icon-check"><li>Плёнка</li></ul>' },
        {
          body: '<ul class="icon-check"><li>Film</li></ul><img src="https://tracker.example/px.png">',
        },
        '',
      ),
    ).toThrow(/<img>/);
  });

  it('accepts a translation that drops a tag the source had', () => {
    expect(() =>
      assertSafeTranslation(
        { body: '<ul><li>Один</li></ul>' },
        { body: 'One' },
        '',
      ),
    ).not.toThrow();
  });

  it('ignores tag-name casing when comparing', () => {
    expect(() =>
      assertSafeTranslation(
        { body: '<UL><LI>Один</LI></UL>' },
        { body: '<ul><li>One</li></ul>' },
        '',
      ),
    ).not.toThrow();
  });

  it('reports "no items" when the response replaced a list with something else entirely', () => {
    expect(() =>
      assertSafeTranslation({ general: ['а', 'б'] }, { general: 'nope' }, ''),
    ).toThrow('has no items, expected 2');
  });

  it('does not throw when locale-invariant numbers and flags come back untouched', () => {
    expect(() =>
      assertSafeTranslation(
        { rows: [{ panel: 'Крыша', value: 78, thin: true }], note: null },
        { rows: [{ panel: 'Roof', value: 78, thin: true }], note: null },
        '',
      ),
    ).not.toThrow();
  });

  it('throws when the translation rewrites a number (a unit conversion the model invented)', () => {
    expect(() =>
      assertSafeTranslation(
        { rows: [{ panel: 'Крыша', value: 78 }] },
        { rows: [{ panel: 'Roof', value: 3.1 }] },
        '',
      ),
    ).toThrow('rows[0].value');
  });

  it('throws when the translation drops a boolean flag', () => {
    expect(() => assertSafeTranslation({ thin: true }, {}, '')).toThrow(
      'changed a non-text value: true -> undefined',
    );
  });
});

describe('mixed-script words', () => {
  it('rejects a Latin word the model finished in Cyrillic', () => {
    expect(() =>
      assertSafeTranslation(
        'с подушкой безопасности',
        'sa vazdušnim jastuком',
        'meta',
      ),
    ).toThrow(/mixes Latin and Cyrillic/);
  });

  it('rejects the reverse splice too', () => {
    expect(() => assertSafeTranslation('подушка', 'подushка', 'meta')).toThrow(
      /mixes Latin and Cyrillic/,
    );
  });

  it('names the offending pair so the field can be found', () => {
    expect(() =>
      assertSafeTranslation('подушка', 'jastuком', 'services.x'),
    ).toThrow(/near "uк"/);
  });

  it('allows a Cyrillic word standing on its own in a Latin sentence', () => {
    expect(() =>
      assertSafeTranslation('Наше слово', 'Naše ваше', 'meta'),
    ).not.toThrow();
  });

  it('allows a fully Latin translation', () => {
    expect(() =>
      assertSafeTranslation('подушка безопасности', 'vazdušni jastuk', 'meta'),
    ).not.toThrow();
  });

  it('allows the source language passing through unchanged', () => {
    expect(() =>
      assertSafeTranslation('BMW X5', 'BMW X5', 'meta'),
    ).not.toThrow();
  });
});
