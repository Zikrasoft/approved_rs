import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LOCALE_CHOICE_ATTRIBUTE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  defineLocaleChoice,
  localeCookieValue,
} from './localeCookie.ts';

const MARKUP_SELECTOR = '[data-lang-choice]';

let registry: Map<string, new () => { connectedCallback(): void }>;
let doc: { cookie: string };

beforeEach(() => {
  registry = new Map();
  doc = { cookie: '' };
  vi.stubGlobal(
    'HTMLElement',
    class {
      listeners = new Map<string, (event: unknown) => void>();
      addEventListener(type: string, fn: (event: unknown) => void) {
        this.listeners.set(type, fn);
      }
    },
  );
  vi.stubGlobal('customElements', {
    get: (name: string) => registry.get(name),
    define: (name: string, ctor: new () => { connectedCallback(): void }) =>
      void registry.set(name, ctor),
  });
  vi.stubGlobal('document', doc);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Mounted = {
  listeners: Map<string, (event: unknown) => void>;
  connectedCallback(): void;
};

function mount(tagName = 'locale-choice'): Mounted {
  defineLocaleChoice(tagName);
  const Ctor = registry.get(tagName)!;
  const element = new Ctor() as unknown as Mounted;
  element.connectedCallback();
  return element;
}

function clickTarget(langChoice?: string) {
  const marked =
    langChoice === undefined
      ? { dataset: {} as Record<string, string> }
      : { dataset: { langChoice } };
  return {
    closest: (selector: string) =>
      selector === MARKUP_SELECTOR ? marked : null,
  };
}

describe('localeCookieValue', () => {
  it('writes a year-long root-scoped cookie under the name middleware reads', () => {
    expect(localeCookieValue('sr')).toBe(
      `${LOCALE_COOKIE}=sr; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`,
    );
  });

  it('keeps the cookie same-site so an ordinary navigation still carries it', () => {
    expect(localeCookieValue('en')).toContain('samesite=lax');
  });

  it('escapes the value instead of letting it inject cookie attributes', () => {
    expect(localeCookieValue('sr; path=/admin')).toBe(
      `${LOCALE_COOKIE}=sr%3B%20path%3D%2Fadmin; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`,
    );
  });
});

describe('defineLocaleChoice', () => {
  it('registers under the default tag name', () => {
    defineLocaleChoice();
    expect(registry.has('locale-choice')).toBe(true);
  });

  it('accepts a per-brand tag name', () => {
    defineLocaleChoice('lang-picker');
    expect(registry.has('lang-picker')).toBe(true);
  });

  it('is idempotent so a second import cannot throw', () => {
    defineLocaleChoice();
    const first = registry.get('locale-choice');
    defineLocaleChoice();
    expect(registry.get('locale-choice')).toBe(first);
  });

  it('listens for a click, not some other event', () => {
    expect([...mount().listeners.keys()]).toEqual(['click']);
  });

  it('stores the locale of the control the click landed in', () => {
    const element = mount();
    element.listeners.get('click')!({ target: clickTarget('sr') });
    expect(doc.cookie).toBe(localeCookieValue('sr'));
  });

  it('looks the control up by the attribute the markup actually carries', () => {
    expect(`[${LOCALE_CHOICE_ATTRIBUTE}]`).toBe(MARKUP_SELECTOR);
  });

  it('ignores a click that landed outside any language control', () => {
    const element = mount();
    element.listeners.get('click')!({
      target: { closest: () => null },
    });
    expect(doc.cookie).toBe('');
  });

  it('ignores a marked control carrying no locale', () => {
    const element = mount();
    element.listeners.get('click')!({ target: clickTarget() });
    expect(doc.cookie).toBe('');
  });

  it('survives a click that reports no target at all', () => {
    const element = mount();
    element.listeners.get('click')!({ target: null });
    expect(doc.cookie).toBe('');
  });
});
