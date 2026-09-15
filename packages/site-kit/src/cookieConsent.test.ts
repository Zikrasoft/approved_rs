// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, newConsent } from './consent.ts';
import {
  CONSENT_EVENT,
  defineCookieConsent,
  readConsent,
  saveConsent,
  type ConsentDetail,
} from './cookieConsent.ts';

const VERSION = '2026-09-12';

let tagSeq = 0;

function mount(version = VERSION): HTMLElement {
  const tagName = `cookie-consent-${(tagSeq += 1)}`;
  defineCookieConsent(tagName);
  document.body.innerHTML = `
    <${tagName} data-policy-version="${version}" hidden>
      <button data-consent-decline>Отклонить</button>
      <button data-consent-accept><span>Принять</span></button>
    </${tagName}>
    <a href="/privacy/" data-cookie-settings>Настройки</a>
  `;
  return document.querySelector<HTMLElement>(tagName)!;
}

function click(selector: string): void {
  document.querySelector<HTMLElement>(selector)!.click();
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  vi.useFakeTimers();
  window.scrollY = 0;
});

function scrollTo(y: number): void {
  window.scrollY = y;
  window.dispatchEvent(new Event('scroll'));
}

describe('defineCookieConsent', () => {
  it('registers once per tag name', () => {
    const tagName = `cookie-consent-idem-${(tagSeq += 1)}`;
    defineCookieConsent(tagName);
    const first = customElements.get(tagName);
    defineCookieConsent(tagName);
    expect(customElements.get(tagName)).toBe(first);
  });

  it('waits before asking a visitor who has not answered yet', () => {
    const el = mount();
    expect(el.hidden).toBe(true);
    vi.advanceTimersByTime(6000);
    expect(el.hidden).toBe(false);
  });

  it('asks as soon as the visitor scrolls past the fold', () => {
    const el = mount();
    scrollTo(100);
    expect(el.hidden).toBe(true);
    scrollTo(700);
    expect(el.hidden).toBe(false);
  });

  it('never asks a visitor who answered while the timer was running', () => {
    const el = mount();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(newConsent(true, VERSION, new Date())),
    );
    vi.advanceTimersByTime(6000);
    expect(el.hidden).toBe(true);
  });

  it('stays visible when reconnected after the reveal', () => {
    const el = mount();
    vi.advanceTimersByTime(6000);
    (el as unknown as { connectedCallback: () => void }).connectedCallback();
    expect(el.hidden).toBe(false);
  });

  it('drops a pending reveal when the element goes away', () => {
    const el = mount();
    el.remove();
    vi.advanceTimersByTime(6000);
    expect(el.hidden).toBe(true);
  });

  it('stays out of the way once an answer is stored', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(newConsent(false, VERSION, new Date())),
    );
    expect(mount().hidden).toBe(true);
  });

  it('asks again after a policy bump', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(newConsent(true, '2020-01-01', new Date())),
    );
    const el = mount();
    vi.advanceTimersByTime(6000);
    expect(el.hidden).toBe(false);
  });

  it('records an acceptance and announces it', () => {
    const el = mount();
    const heard: ConsentDetail[] = [];
    el.addEventListener(CONSENT_EVENT, (event) =>
      heard.push((event as CustomEvent<ConsentDetail>).detail),
    );

    click('[data-consent-accept]');

    expect(heard).toEqual([{ analytics: true }]);
    expect(readConsent(VERSION)?.analytics).toBe(true);
    expect(el.hidden).toBe(true);
  });

  it('records a refusal', () => {
    const el = mount();
    const heard: ConsentDetail[] = [];
    el.addEventListener(CONSENT_EVENT, (event) =>
      heard.push((event as CustomEvent<ConsentDetail>).detail),
    );

    click('[data-consent-decline]');

    expect(heard).toEqual([{ analytics: false }]);
    expect(readConsent(VERSION)?.analytics).toBe(false);
    expect(el.hidden).toBe(true);
  });

  it('answers for a click that lands on markup inside the button', () => {
    const el = mount();
    click('[data-consent-accept] span');
    expect(readConsent(VERSION)?.analytics).toBe(true);
    expect(el.hidden).toBe(true);
  });

  it('ignores a click on the banner that is not an answer', () => {
    const el = mount();
    vi.advanceTimersByTime(6000);
    el.click();
    expect(el.hidden).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reopens from a settings link and suppresses its navigation', () => {
    const el = mount();
    click('[data-consent-decline]');
    expect(el.hidden).toBe(true);

    const link = document.querySelector<HTMLAnchorElement>(
      '[data-cookie-settings]',
    )!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(el.hidden).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores an unrelated document click', () => {
    const el = mount();
    click('[data-consent-accept]');
    document.body.click();
    expect(el.hidden).toBe(true);
  });

  it('records an answer even when the element carries no policy version', () => {
    const tagName = `cookie-consent-bare-${(tagSeq += 1)}`;
    defineCookieConsent(tagName);
    document.body.innerHTML = `<${tagName}><button data-consent-accept>y</button></${tagName}>`;
    click('[data-consent-accept]');
    expect(readConsent('')?.analytics).toBe(true);
  });

  it('stops listening once it leaves the document', () => {
    const el = mount();
    click('[data-consent-decline]');
    el.remove();

    document.querySelector<HTMLElement>('[data-cookie-settings]')!.click();

    expect(el.hidden).toBe(true);
  });

  it('re-wires when it is put back', () => {
    const el = mount();
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    click('[data-consent-accept]');
    expect(readConsent(VERSION)?.analytics).toBe(true);
  });
});

describe('readConsent and saveConsent', () => {
  it('treats a storage that refuses to be read as no answer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readConsent(VERSION)).toBeNull();
    vi.restoreAllMocks();
  });

  it('returns the answer even when it cannot be written down', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(saveConsent(true, VERSION).analytics).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('the answer reaching the rest of the page', () => {
  it('announces to the document, which is where the analytics loader listens', () => {
    const heard: ConsentDetail[] = [];
    document.addEventListener(CONSENT_EVENT, (event) =>
      heard.push((event as CustomEvent<ConsentDetail>).detail),
    );
    mount();
    click('[data-consent-accept]');
    expect(heard).toEqual([{ analytics: true }]);
  });

  it('answers once when reconnected without an intervening disconnect', () => {
    const el = mount();
    const heard: ConsentDetail[] = [];
    el.addEventListener(CONSENT_EVENT, (event) =>
      heard.push((event as CustomEvent<ConsentDetail>).detail),
    );
    (el as unknown as { connectedCallback: () => void }).connectedCallback();
    click('[data-consent-accept]');
    expect(heard).toEqual([{ analytics: true }]);
  });
});
