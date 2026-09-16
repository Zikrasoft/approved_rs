import { describe, it, expect } from 'vitest';
import { assertSafeTranslation } from './assertSafeTranslation';

describe('assertSafeTranslation', () => {
  it('refuses a blank translation of a non-blank source', () => {
    expect(() =>
      assertSafeTranslation('Услуги', '   ', 'nav.services'),
    ).toThrow('came back blank');
  });

  it('leaves a blank source alone', () => {
    expect(() => assertSafeTranslation('', '', 'blank')).not.toThrow();
  });

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

  it('throws when an array is longer than the source (an invented item)', () => {
    expect(() =>
      assertSafeTranslation({ general: [1] }, { general: [1, 2] }, ''),
    ).toThrow(/general/);
  });

  it('throws when the translation smuggles in an HTML comment', () => {
    expect(() =>
      assertSafeTranslation(
        { body: 'Обычный текст.' },
        { body: 'Tekst <!-- skriveno -->' },
        '',
      ),
    ).toThrow(/body/);
  });

  it('tells two numbered heading levels apart', () => {
    expect(() =>
      assertSafeTranslation(
        { body: '<h1>Заголовок</h1>' },
        { body: '<h2>Naslov</h2>' },
        '',
      ),
    ).toThrow(/<h2>/);
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

  it('gives the same answer when asked twice', () => {
    const check = () => assertSafeTranslation('подушка', 'подushка', 'meta');
    expect(check).toThrow(/mixes Latin and Cyrillic/);
    expect(check).toThrow(/mixes Latin and Cyrillic/);
  });

  it('accepts a whitespace-only source translated as whitespace', () => {
    expect(() => assertSafeTranslation('   ', '   ', 'x')).not.toThrow();
  });

  it('names the whole offending word so the field can be found', () => {
    expect(() =>
      assertSafeTranslation('подушка', 'vazdušnim jastuком', 'services.x'),
    ).toThrow(/"jastuком"/);
  });

  it('exempts only the spliced word the source already had, not the string', () => {
    expect(() =>
      assertSafeTranslation('Hondа Accord чинится', 'Hondа Accord radi', 'x'),
    ).not.toThrow();
    expect(() =>
      assertSafeTranslation('Hondа Accord чинится', 'Hondа Accord radи', 'x'),
    ).toThrow(/"radи"/);
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

describe('placeholder tokens', () => {
  it('rejects a translation that dropped a token to save characters', () => {
    expect(() =>
      assertSafeTranslation(
        'Политика конфиденциальности сайта {siteName}: какие данные мы собираем',
        'Datenschutzerklärung der Website: welche Daten wir erheben',
        'privacy.metaDescription',
      ),
    ).toThrow(/dropped placeholder tokens \(\{siteName\}\)/);
  });

  it('names every token that went missing', () => {
    expect(() =>
      assertSafeTranslation('{car} {year} в {location}', 'Auto', 'meta'),
    ).toThrow(/\{car\} \{year\} \{location\}/);
  });

  it('accepts a translation that moved a token but kept it', () => {
    expect(() =>
      assertSafeTranslation(
        'Подбор авто {location} — {siteName}',
        '{siteName}: Fahrzeugsuche {location}',
        'meta',
      ),
    ).not.toThrow();
  });

  it('says nothing about a source that carries no tokens', () => {
    expect(() =>
      assertSafeTranslation('Обычная строка', 'A plain string', 'x'),
    ).not.toThrow();
  });
});
