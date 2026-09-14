// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineMenuToggle, type MenuToggleElement } from './menuToggle.ts';
import { lockScroll, unlockScroll } from './scrollLock.ts';

vi.mock('./scrollLock.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./scrollLock.ts')>();
  return {
    lockScroll: vi.fn(actual.lockScroll),
    unlockScroll: vi.fn(actual.unlockScroll),
  };
});

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
  vi.mocked(lockScroll).mockClear();
  vi.mocked(unlockScroll).mockClear();
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
  attributes = `data-desktop-media="${DESKTOP}" data-lock-scroll`,
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
      `data-desktop-media="${DESKTOP}" data-lock-scroll`,
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
      `data-desktop-media="${DESKTOP}" data-lock-scroll data-close-selector="a,[data-open-lead-modal]"`,
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
      `data-desktop-media="${DESKTOP}" data-lock-scroll data-close-selector="button"`,
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

  it('closes when a modal opens anywhere on the page', () => {
    const { host, button } = mount();
    button.click();
    document.dispatchEvent(new CustomEvent('modal:open', { bubbles: true }));

    expect(host.hasAttribute('data-open')).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('stays open on any other key', () => {
    const { host, button } = mount();
    button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(host.hasAttribute('data-open')).toBe(true);
  });

  it('watches the breakpoint the host asks for', () => {
    mount('data-desktop-media="(min-width: 1024px)" data-lock-scroll');

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

  it('leaves the page scrollable when the host does not ask for a lock', () => {
    const { host, button } = mount(`data-desktop-media="${DESKTOP}"`);
    const menu = host.querySelector<HTMLElement>('[data-menu]')!;
    button.click();

    expect(host.hasAttribute('data-open')).toBe(true);
    expect(menu.hasAttribute('inert')).toBe(false);
    expect(lockScroll).not.toHaveBeenCalled();

    button.click();
    expect(menu.hasAttribute('inert')).toBe(true);
    expect(unlockScroll).not.toHaveBeenCalled();
  });

  it('releases nothing on teardown when it never took the lock', () => {
    const { host, button } = mount(`data-desktop-media="${DESKTOP}"`);
    button.click();
    host.remove();

    expect(unlockScroll).not.toHaveBeenCalled();
  });

  it('ignores requests once the element is torn down', () => {
    const { host, button } = mount();
    button.click();
    host.remove();
    vi.mocked(unlockScroll).mockClear();

    (host as MenuToggleElement).setMenuOpen(true);

    expect(host.hasAttribute('data-open')).toBe(false);
    expect(lockScroll).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('marks the menu inert while it is closed', () => {
    const { host, button } = mount();
    const menu = host.querySelector<HTMLElement>('[data-menu]')!;

    expect(menu.hasAttribute('inert')).toBe(true);

    button.click();
    expect(menu.hasAttribute('inert')).toBe(false);

    button.click();
    expect(menu.hasAttribute('inert')).toBe(true);
  });

  it('opens and closes on request from the host app', () => {
    const { host, button } = mount();
    const menu = host.querySelector<HTMLElement>('[data-menu]')!;
    const api = host as MenuToggleElement;

    api.setMenuOpen(true);
    expect(host.hasAttribute('data-open')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    api.setMenuOpen(false);
    expect(menu.hasAttribute('inert')).toBe(true);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('ignores a request made before the element is wired', () => {
    const tagName = `menu-toggle-${++tagSeed}`;
    defineMenuToggle(tagName);
    const host = document.createElement(tagName) as MenuToggleElement;

    expect(() => host.setMenuOpen(true)).not.toThrow();
    expect(host.hasAttribute('data-open')).toBe(false);
  });

  it('works without a menu element', () => {
    const tagName = `menu-toggle-${++tagSeed}`;
    defineMenuToggle(tagName);
    document.body.innerHTML = `
      <${tagName} data-desktop-media="${DESKTOP}">
        <button data-menu-button aria-label="Меню"></button>
      </${tagName}>`;
    const host = document.querySelector(tagName)!;
    host.querySelector('button')!.click();

    expect(host.hasAttribute('data-open')).toBe(true);
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
