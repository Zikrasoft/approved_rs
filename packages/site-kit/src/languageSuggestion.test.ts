// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  defineLanguageSuggestion,
  LANGUAGE_SUGGESTION_STORAGE_KEY,
  pageAlternates,
  preferredAlternate,
} from './languageSuggestion.ts';

const ALTERNATES = `
  <link rel="alternate" hreflang="ru" href="https://approved.rs/ru/contacts/" />
  <link rel="alternate" hreflang="en" href="https://approved.rs/en/contacts/" />
  <link rel="alternate" hreflang="sr" href="https://approved.rs/sr/contacts/" />
  <link rel="alternate" hreflang="x-default" href="https://approved.rs/ru/contacts/" />`;

const BAR = `
  <language-suggestion hidden>
    <a data-lang-link href="#"></a>
    <button type="button" data-lang-dismiss>×</button>
  </language-suggestion>`;

const bar = () => document.querySelector<HTMLElement>('language-suggestion')!;
const link = () =>
  document.querySelector<HTMLAnchorElement>('[data-lang-link]')!;

function render(lang: string, languages: readonly string[], head = ALTERNATES) {
  document.documentElement.lang = lang;
  document.head.innerHTML = head;
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(
    languages as string[],
  );
  document.body.innerHTML = BAR;
}

beforeEach(() => {
  localStorage.clear();
  defineLanguageSuggestion();
});

afterEach(() => vi.restoreAllMocks());

describe('preferredAlternate', () => {
  it('offers the first preference the site actually has', () => {
    expect(
      preferredAlternate('sr', ['ru-RU', 'ru', 'en'], ['ru', 'en', 'sr']),
    ).toBe('ru');
  });

  it('stays quiet when the visitor already reads this page language', () => {
    expect(
      preferredAlternate('ru', ['ru-RU', 'en'], ['ru', 'en']),
    ).toBeUndefined();
  });

  it('compares the language subtag, so sr-RS counts as Serbian', () => {
    expect(
      preferredAlternate('sr-RS', ['sr-Latn-RS'], ['ru', 'sr']),
    ).toBeUndefined();
    expect(preferredAlternate('sr-RS', ['ru-RU'], ['ru', 'sr'])).toBe('ru');
  });

  it('skips a preference the site does not publish', () => {
    expect(preferredAlternate('sr', ['it', 'ru'], ['ru', 'sr'])).toBe('ru');
  });

  it('stays quiet when nothing the visitor reads is available', () => {
    expect(
      preferredAlternate('sr', ['it', 'fr'], ['ru', 'sr']),
    ).toBeUndefined();
  });

  it('stays quiet for a visitor with no stated preference', () => {
    expect(preferredAlternate('sr', [], ['ru', 'sr'])).toBeUndefined();
  });
});

describe('pageAlternates', () => {
  it('collects the hreflang links and drops x-default', () => {
    document.head.innerHTML = ALTERNATES;
    expect([...pageAlternates(document).keys()]).toEqual(['ru', 'en', 'sr']);
  });

  it('keeps the first link when a tag is repeated', () => {
    document.head.innerHTML = `
      <link rel="alternate" hreflang="ru" href="https://approved.rs/ru/first/" />
      <link rel="alternate" hreflang="ru" href="https://approved.rs/ru/second/" />`;
    expect(pageAlternates(document).get('ru')).toBe(
      'https://approved.rs/ru/first/',
    );
  });

  it('ignores an alternate link with an empty hreflang', () => {
    document.head.innerHTML = `<link rel="alternate" hreflang="" href="/x/" />`;
    expect(pageAlternates(document).size).toBe(0);
  });
});

describe('<language-suggestion>', () => {
  it('offers the Russian page to a Russian speaker reading Serbian', () => {
    render('sr', ['ru-RU', 'ru']);

    expect(bar().hidden).toBe(false);
    expect(link().href).toBe('https://approved.rs/ru/contacts/');
    expect(link().textContent).toBe('Показать на русском');
    expect(link().lang).toBe('ru');
  });

  it('labels the offer in the language it leads to, not the page language', () => {
    render(
      'ru',
      ['de-DE'],
      ALTERNATES +
        '<link rel="alternate" hreflang="de" href="https://approved.rs/de/contacts/" />',
    );

    expect(link().textContent).toBe('Auf Deutsch anzeigen');
  });

  it('stays hidden for a visitor already on their language', () => {
    render('ru', ['ru-RU', 'en']);

    expect(bar().hidden).toBe(true);
  });

  it('stays hidden once the visitor dismissed it', () => {
    localStorage.setItem(LANGUAGE_SUGGESTION_STORAGE_KEY, '1');
    render('sr', ['ru-RU']);

    expect(bar().hidden).toBe(true);
  });

  it('remembers a dismissal and hides the bar', () => {
    render('sr', ['ru-RU']);
    document.querySelector<HTMLElement>('[data-lang-dismiss]')!.click();

    expect(bar().hidden).toBe(true);
    expect(localStorage.getItem(LANGUAGE_SUGGESTION_STORAGE_KEY)).toBe('1');
  });

  it('stops offering once the visitor took the offer', () => {
    render('sr', ['ru-RU']);
    link().addEventListener('click', (event) => event.preventDefault());
    link().click();

    expect(localStorage.getItem(LANGUAGE_SUGGESTION_STORAGE_KEY)).toBe('1');
  });

  it('ignores a click on the bar itself', () => {
    render('sr', ['ru-RU']);
    bar().click();

    expect(bar().hidden).toBe(false);
    expect(localStorage.getItem(LANGUAGE_SUGGESTION_STORAGE_KEY)).toBeNull();
  });

  it('stays hidden on a page with no alternates', () => {
    render('sr', ['ru-RU'], '');

    expect(bar().hidden).toBe(true);
  });

  it('stays hidden when the offered locale has no wording', () => {
    render(
      'ru',
      ['it-IT'],
      `<link rel="alternate" hreflang="it" href="/it/" />`,
    );

    expect(bar().hidden).toBe(true);
  });

  it('does nothing in markup that carries no link', () => {
    document.documentElement.lang = 'sr';
    document.head.innerHTML = ALTERNATES;
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ru']);
    document.body.innerHTML = `<language-suggestion hidden></language-suggestion>`;

    expect(bar().hidden).toBe(true);
  });

  it('survives a browser that reports no language preferences', () => {
    render('sr', undefined as unknown as string[]);

    expect(bar().hidden).toBe(true);
  });

  it('shows the offer when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    render('sr', ['ru-RU']);

    expect(bar().hidden).toBe(false);
  });

  it('still hides the bar when the dismissal cannot be stored', () => {
    render('sr', ['ru-RU']);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    document.querySelector<HTMLElement>('[data-lang-dismiss]')!.click();

    expect(bar().hidden).toBe(true);
  });

  it('registers once, so a second call cannot redefine the element', () => {
    expect(() => defineLanguageSuggestion()).not.toThrow();
  });

  it('rebinds cleanly when the bar is reconnected without disconnecting', () => {
    render('sr', ['ru-RU']);
    const el = bar() as HTMLElement & { connectedCallback(): void };
    el.connectedCallback();
    document.querySelector<HTMLElement>('[data-lang-dismiss]')!.click();

    expect(el.hidden).toBe(true);
    expect(localStorage.getItem(LANGUAGE_SUGGESTION_STORAGE_KEY)).toBe('1');
  });

  it('drops its listeners when the bar leaves the document', () => {
    render('sr', ['ru-RU']);
    const el = bar();
    el.remove();
    el.dispatchEvent(new Event('click', { bubbles: true }));

    expect(localStorage.getItem(LANGUAGE_SUGGESTION_STORAGE_KEY)).toBeNull();
  });
});
