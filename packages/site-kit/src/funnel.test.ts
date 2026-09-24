// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineFunnelTracking, fieldName, scrolledPercent } from './funnel.ts';
import { GOALS, reachGoal } from './goals.ts';

const FORM = `
  <form data-lead-form>
    <input type="hidden" name="service" value="" />
    <input name="phone" />
    <button type="submit">Send</button>
  </form>`;

let page: AbortController;
let observed: Element[];
let notify: (entries: { isIntersecting: boolean }[]) => void;
let disconnected: number;

const goals = () => (window.ymReachGoal as ReturnType<typeof vi.fn>).mock.calls;
const goalNames = () => goals().map(([name]) => name);

function stubIntersectionObserver(): void {
  class Stub {
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
      notify = callback;
    }
    observe(element: Element): void {
      observed.push(element);
    }
    disconnect(): void {
      disconnected += 1;
    }
  }
  vi.stubGlobal('IntersectionObserver', Stub);
}

function stubViewport(scrollHeight: number, innerHeight: number): void {
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(
    scrollHeight,
  );
  vi.stubGlobal('innerHeight', innerHeight);
}

const start = (): void => defineFunnelTracking(page.signal);

function typeInto(field: HTMLInputElement): void {
  field.value += 'a';
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

const submitEvent = (): Event =>
  new Event('submit', { cancelable: true, bubbles: true });

function blockedSubmit(form: HTMLFormElement): void {
  form.addEventListener('submit', (event) => event.preventDefault(), {
    once: true,
  });
  form.dispatchEvent(submitEvent());
}

const scrollTo = (y: number): void => {
  vi.stubGlobal('scrollY', y);
  dispatchEvent(new Event('scroll'));
};

beforeEach(() => {
  page = new AbortController();
  observed = [];
  disconnected = 0;
  document.body.innerHTML = '';
  window.ymReachGoal = vi.fn();
  stubIntersectionObserver();
  stubViewport(2000, 1000);
  vi.stubGlobal('scrollY', 0);
});

afterEach(() => {
  page.abort();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('scrolledPercent', () => {
  it('reports how far down the page the viewport has moved', () => {
    stubViewport(3000, 1000);
    vi.stubGlobal('scrollY', 1000);
    expect(scrolledPercent()).toBe(50);
  });

  it('counts a page shorter than the viewport as fully read', () => {
    stubViewport(600, 1000);
    expect(scrolledPercent()).toBe(100);
  });
});

describe('fieldName', () => {
  it('prefers the analytics hook over the POST field name', () => {
    const control = document.createElement('input');
    control.setAttribute('name', 'contact');
    control.setAttribute('data-field', 'phone');
    expect(fieldName(control)).toBe('phone');
  });

  it('says so loudly when a control carries neither', () => {
    expect(fieldName(document.createElement('input'))).toBe('unknown');
  });
});

describe('defineFunnelTracking', () => {
  it('reports half and nearly all of a long page as it is scrolled', () => {
    start();
    expect(goalNames()).toEqual([]);

    scrollTo(500);
    expect(goalNames()).toEqual([GOALS.scroll50]);

    scrollTo(950);
    expect(goalNames()).toEqual([GOALS.scroll50, GOALS.scroll90]);
  });

  it('reports each depth once however much the visitor scrolls', () => {
    start();
    scrollTo(950);
    scrollTo(1000);
    scrollTo(300);
    expect(goalNames()).toEqual([GOALS.scroll50, GOALS.scroll90]);
  });

  it('reports a page that fits the screen as read without any scrolling', () => {
    stubViewport(500, 1000);
    start();
    expect(goalNames()).toEqual([GOALS.scroll50, GOALS.scroll90]);
  });

  it('reports the form coming into view', () => {
    document.body.innerHTML = FORM;
    start();
    expect(observed).toHaveLength(1);

    notify([{ isIntersecting: true }]);
    expect(goalNames()).toContain(GOALS.formView);
    expect(disconnected).toBe(1);
  });

  it('stays quiet while the form is still below the fold', () => {
    document.body.innerHTML = FORM;
    start();
    notify([{ isIntersecting: false }]);
    expect(goalNames()).not.toContain(GOALS.formView);
  });

  it('reports the first thing the visitor types, and only the first', () => {
    document.body.innerHTML = FORM;
    start();
    const field = document.querySelector<HTMLInputElement>(
      'input[name="phone"]',
    )!;
    typeInto(field);
    typeInto(field);
    expect(goalNames().filter((name) => name === GOALS.formStart)).toHaveLength(
      1,
    );
  });

  it('does not count the modal putting a cursor in a field as starting', () => {
    document.body.innerHTML = FORM;
    start();
    document.querySelector<HTMLInputElement>('input[name="phone"]')!.focus();
    expect(goalNames()).not.toContain(GOALS.formStart);
  });

  it('reports a submit the page let through to the server', () => {
    document.body.innerHTML = FORM;
    start();
    document.querySelector('form')!.dispatchEvent(submitEvent());
    expect(goals()).toContainEqual([GOALS.formSubmit, { service: 'none' }]);
  });

  it('names the service a submitted form carried, so a partner lead is countable', () => {
    document.body.innerHTML = FORM;
    start();
    const form = document.querySelector('form')!;
    form.querySelector<HTMLInputElement>('input[name="service"]')!.value =
      'partner-details';
    form.dispatchEvent(submitEvent());
    expect(goals()).toContainEqual([
      GOALS.formSubmit,
      { service: 'partner-details' },
    ]);
  });

  it('reports the field that blocked the submit instead of a success', () => {
    document.body.innerHTML = FORM;
    start();
    document
      .querySelector('input[name="phone"]')!
      .setAttribute('aria-invalid', 'true');
    blockedSubmit(document.querySelector('form')!);
    expect(goals()).toContainEqual([GOALS.formError, { field: 'phone' }]);
    expect(goalNames()).not.toContain(GOALS.formSubmit);
  });

  it('names a blocking control that carries no name attribute', () => {
    document.body.innerHTML = `
      <form data-lead-form>
        <div data-field="consent" aria-invalid="true"></div>
      </form>`;
    start();
    blockedSubmit(document.querySelector('form')!);
    expect(goals()).toContainEqual([GOALS.formError, { field: 'consent' }]);
  });

  it('says unknown when a blocking control carries no name at all', () => {
    document.body.innerHTML = `
      <form data-lead-form><fieldset aria-invalid="true"></fieldset></form>`;
    start();
    blockedSubmit(document.querySelector('form')!);
    expect(goals()).toContainEqual([GOALS.formError, { field: 'unknown' }]);
  });

  it('ignores a focus the page moved itself, not the visitor', () => {
    document.body.innerHTML = FORM;
    start();
    document
      .querySelector('input[name="phone"]')!
      .dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(goalNames()).not.toContain(GOALS.formStart);
  });

  it('stays quiet when the page holds the submit back to load its phone kit', () => {
    document.body.innerHTML = FORM;
    start();
    const form = document.querySelector('form')!;
    form.setAttribute('data-awaiting-kit', '1');
    form
      .querySelector('input[name="phone"]')!
      .setAttribute('aria-invalid', 'true');
    blockedSubmit(form);
    expect(goalNames()).not.toContain(GOALS.formSubmit);
    expect(goalNames()).not.toContain(GOALS.formError);

    form.removeAttribute('data-awaiting-kit');
    form.querySelector('input[name="phone"]')!.removeAttribute('aria-invalid');
    form.dispatchEvent(submitEvent());
    expect(goalNames()).toContain(GOALS.formSubmit);
  });

  it('ignores a submit from a form that is not the lead form', () => {
    document.body.innerHTML = `${FORM}<form id="search"></form>`;
    start();
    document.querySelector('#search')!.dispatchEvent(submitEvent());
    expect(goalNames()).not.toContain(GOALS.formSubmit);
  });

  it('does nothing about forms on a page that carries none', () => {
    start();
    expect(observed).toEqual([]);
  });

  it('reports a click that sends the visitor to a sister site', () => {
    document.body.innerHTML = `
      <a data-brand-link="details" href="https://details.rs/"><span>Go</span></a>`;
    document.querySelector('span')!.click();
    start();
    document.querySelector('span')!.click();
    expect(goals()).toContainEqual([GOALS.brandLinkClick, { to: 'details' }]);
  });

  it('ignores an ordinary link', () => {
    document.body.innerHTML = `<a href="/ru/">Home</a>`;
    start();
    document.querySelector('a')!.click();
    expect(goalNames()).not.toContain(GOALS.brandLinkClick);
  });

  it('counts a page once however often the layout arms it', () => {
    document.body.innerHTML = FORM;
    start();
    start();
    scrollTo(950);
    expect(goalNames().filter((name) => name === GOALS.scroll50)).toHaveLength(
      1,
    );
    expect(goalNames().filter((name) => name === GOALS.scroll90)).toHaveLength(
      1,
    );
  });

  it('works on a page that never hands back a signal', async () => {
    vi.resetModules();
    const fresh = await import('./funnel.ts');
    document.body.innerHTML = FORM;
    fresh.defineFunnelTracking();
    scrollTo(950);
    expect(goalNames()).toContain(GOALS.scroll90);
  });

  it('stops watching everything once the page hands back its signal', () => {
    document.body.innerHTML = FORM;
    const controller = new AbortController();
    defineFunnelTracking(controller.signal);
    controller.abort();

    scrollTo(950);
    typeInto(document.querySelector<HTMLInputElement>('input[name="phone"]')!);
    expect(disconnected).toBe(1);
    expect(goalNames()).not.toContain(GOALS.scroll90);
    expect(goalNames()).not.toContain(GOALS.formStart);
  });
});

describe('reachGoal', () => {
  it('stays silent on a page where analytics never loaded', () => {
    delete (window as Partial<Window>).ymReachGoal;
    expect(() => reachGoal(GOALS.formView)).not.toThrow();
  });
});
