// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineMenuToggle } from './menuToggle.ts';

const DESKTOP = '(min-width: 768px)';

type MediaStub = {
  matches: boolean;
  addEventListener: (
    type: string,
    fn: (event: MediaQueryListEvent) => void,
    options?: AddEventListenerOptions,
  ) => void;
};

let queries: string[];
let media: MediaStub;
let listeners: Array<(event: MediaQueryListEvent) => void>;

function grow() {
  listeners.forEach((fn) => fn({ matches: true } as MediaQueryListEvent));
}

function shrink() {
  listeners.forEach((fn) => fn({ matches: false } as MediaQueryListEvent));
}

beforeEach(() => {
  queries = [];
  listeners = [];
  media = {
    matches: false,
    addEventListener: (_type, fn, options) => {
      listeners.push(fn);
      options?.signal?.addEventListener('abort', () => {
        listeners = listeners.filter((known) => known !== fn);
      });
    },
  };
  vi.stubGlobal('matchMedia', (query: string) => {
    queries.push(query);
    return media;
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.style.overflow = '';
  vi.unstubAllGlobals();
});

let tagSeed = 0;

function mount(
  attributes = `data-desktop-media="${DESKTOP}"`,
  menuMarkup = '<div data-menu><a href="/services"><svg></svg></a></div>',
) {
  const tagName = `menu-toggle-${++tagSeed}`;
  defineMenuToggle(tagName);
  document.body.innerHTML = `
    <${tagName} ${attributes}>
      <button data-menu-button aria-label="Меню" data-close-label="Закрыть меню"></button>
      ${menuMarkup}
    </${tagName}>`;
  const host = document.querySelector(tagName)!;
  return {
    host,
    button: host.querySelector('button')!,
    link: host.querySelector('a'),
  };
}

describe('defineMenuToggle', () => {
  it('registers the element once per tag name', () => {
    defineMenuToggle('menu-once');
    const first = customElements.get('menu-once');
    defineMenuToggle('menu-once');
    expect(customElements.get('menu-once')).toBe(first);
  });

  it('opens on click and reports state to assistive tech', () => {
    const { host, button } = mount();
    button.click();

    expect(host.hasAttribute('data-open')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Закрыть меню');
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('closes on a second click and releases the page', () => {
    const { host, button } = mount();
    button.click();
    button.click();

    expect(host.hasAttribute('data-open')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Меню');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('falls back to the open label when no close label is given', () => {
    const tagName = `menu-toggle-${++tagSeed}`;
    defineMenuToggle(tagName);
    document.body.innerHTML = `
      <${tagName} data-desktop-media="${DESKTOP}">
        <button data-menu-button aria-label="Меню"></button>
        <div data-menu></div>
      </${tagName}>`;
    const button = document.querySelector('button')!;
    button.click();

    expect(button.getAttribute('aria-label')).toBe('Меню');
  });

  it('closes when a link deep inside the menu is clicked', () => {
    const { host, link } = mount();
    host.querySelector('button')!.click();
    link!
      .querySelector('svg')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(host.hasAttribute('data-open')).toBe(false);
  });

  it('ignores clicks that miss the close selector', () => {
    const { host, button } = mount(
      `data-desktop-media="${DESKTOP}"`,
      '<div data-menu><span>текст</span></div>',
    );
    button.click();
    host
      .querySelector('span')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(host.hasAttribute('data-open')).toBe(true);
  });

  it('accepts a custom close selector', () => {
    const { host, button } = mount(
      `data-desktop-media="${DESKTOP}" data-close-selector="a,[data-open-lead-modal]"`,
      '<div data-menu><button data-open-lead-modal>Записаться</button></div>',
    );
    button.click();
    host
      .querySelector('[data-open-lead-modal]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(host.hasAttribute('data-open')).toBe(false);
  });

  it('does not close itself when the toggle button matches the close selector', () => {
    const { host, button } = mount(
      `data-desktop-media="${DESKTOP}" data-close-selector="button"`,
      '<div data-menu></div>',
    );
    button.click();

    expect(host.hasAttribute('data-open')).toBe(true);
  });

  it('closes on Escape', () => {
    const { host, button } = mount();
    button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(host.hasAttribute('data-open')).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('leaves the page scrollable when Escape arrives before any opening', () => {
    mount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.documentElement.style.overflow).toBe('');
  });

  it('stays open on any other key', () => {
    const { host, button } = mount();
    button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(host.hasAttribute('data-open')).toBe(true);
  });

  it('watches the breakpoint the host asks for', () => {
    mount('data-desktop-media="(min-width: 1024px)"');

    expect(queries).toEqual(['(min-width: 1024px)']);
  });

  it('closes when the viewport grows past the desktop breakpoint', () => {
    const { host, button } = mount();
    button.click();
    grow();

    expect(host.hasAttribute('data-open')).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('stays open while the viewport is below the breakpoint', () => {
    const { host, button } = mount();
    button.click();
    shrink();

    expect(host.hasAttribute('data-open')).toBe(true);
  });

  it('keeps the scroll lock balanced across repeated toggles', () => {
    const { button } = mount();
    button.click();
    button.click();
    button.click();
    grow();

    expect(document.documentElement.style.overflow).toBe('');
  });

  it('does nothing without a toggle button', () => {
    const tagName = `menu-toggle-${++tagSeed}`;
    defineMenuToggle(tagName);
    document.body.innerHTML = `<${tagName} data-desktop-media="${DESKTOP}"><div data-menu></div></${tagName}>`;
    const host = document.querySelector(tagName)!;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(host.hasAttribute('data-open')).toBe(false);
    expect(queries).toEqual([]);
  });

  it('does nothing until the host declares its desktop breakpoint', () => {
    const { host, button } = mount('');
    button.click();

    expect(host.hasAttribute('data-open')).toBe(false);
    expect(queries).toEqual([]);
  });

  it('releases the page and drops listeners when the element goes away', () => {
    const { host, button } = mount();
    button.click();
    host.remove();

    expect(document.documentElement.style.overflow).toBe('');
    expect(listeners).toEqual([]);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('leaves the labels empty when the button carries none', () => {
    const tagName = `menu-toggle-${++tagSeed}`;
    defineMenuToggle(tagName);
    document.body.innerHTML = `
      <${tagName} data-desktop-media="${DESKTOP}">
        <button data-menu-button></button>
        <div data-menu></div>
      </${tagName}>`;
    const button = document.querySelector('button')!;
    button.click();

    expect(button.getAttribute('aria-label')).toBe('');
  });

  it('ignores a repeated connection without re-wiring listeners', () => {
    const { host, button } = mount();
    (host as HTMLElement & { connectedCallback(): void }).connectedCallback();

    button.click();
    expect(host.hasAttribute('data-open')).toBe(true);

    button.click();
    expect(host.hasAttribute('data-open')).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('wires listeners once when the element is moved in the DOM', () => {
    const { host, button } = mount();
    const parked = document.createElement('div');
    document.body.append(parked);
    parked.append(host);

    button.click();
    expect(host.hasAttribute('data-open')).toBe(true);

    button.click();
    expect(host.hasAttribute('data-open')).toBe(false);
  });
});
