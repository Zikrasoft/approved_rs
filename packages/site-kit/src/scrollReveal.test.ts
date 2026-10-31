// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineScrollReveal } from './scrollReveal.ts';

defineScrollReveal();

let observers: FakeObserver[] = [];

class FakeObserver {
  observed = new Set<Element>();
  disconnected = false;
  constructor(
    public callback: (
      entries: { target: Element; isIntersecting: boolean }[],
    ) => void,
  ) {
    observers.push(this);
  }
  observe(target: Element) {
    this.observed.add(target);
  }
  unobserve(target: Element) {
    this.observed.delete(target);
  }
  disconnect() {
    this.disconnected = true;
  }
}

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches })),
  );

const mount = () => {
  document.body.innerHTML = `
    <scroll-reveal>
      <h1 data-reveal>a</h1>
      <p data-reveal data-reveal-delay="120">b</p>
      <p>c</p>
    </scroll-reveal>`;
  const [heading, delayed] =
    document.querySelectorAll<HTMLElement>('[data-reveal]');
  return { heading, delayed, host: document.querySelector('scroll-reveal')! };
};

const revealed = (el: Element) => el.classList.contains('is-in');

beforeEach(() => {
  observers = [];
  vi.useFakeTimers();
  reducedMotion(false);
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<scroll-reveal>', () => {
  it('reveals each marked element once it scrolls in, after its delay', () => {
    const { heading, delayed } = mount();
    const [observer] = observers;
    expect(observer.observed).toEqual(new Set([heading, delayed]));

    observer.callback([
      { target: heading, isIntersecting: true },
      { target: delayed, isIntersecting: false },
    ]);
    vi.advanceTimersByTime(0);
    expect([revealed(heading), revealed(delayed)]).toEqual([true, false]);
    expect(observer.observed).toEqual(new Set([delayed]));

    observer.callback([{ target: delayed, isIntersecting: true }]);
    vi.advanceTimersByTime(119);
    expect(revealed(delayed)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(revealed(delayed)).toBe(true);
  });

  it('reveals everything when nothing has come in after two seconds', () => {
    const { heading, delayed } = mount();
    vi.advanceTimersByTime(2000);
    expect([revealed(heading), revealed(delayed)]).toEqual([true, true]);
  });

  it('leaves the rest to scrolling once something has come in', () => {
    const { heading, delayed } = mount();
    observers[0].callback([{ target: heading, isIntersecting: true }]);
    vi.advanceTimersByTime(2000);
    expect(revealed(delayed)).toBe(false);
  });

  it.each([
    ['motion is reduced', () => reducedMotion(true)],
    [
      'the browser cannot observe',
      () => vi.stubGlobal('IntersectionObserver', undefined),
    ],
  ])('shows everything at once when %s', (_, setup) => {
    setup();
    const { heading, delayed } = mount();
    expect([revealed(heading), revealed(delayed)]).toEqual([true, true]);
    expect(observers).toHaveLength(0);
  });

  it('stops watching when it leaves the page, and watches again on return', () => {
    const { host, delayed } = mount();
    host.remove();
    expect(observers[0].disconnected).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(revealed(delayed)).toBe(false);
    document.body.append(host);
    expect(observers).toHaveLength(2);
  });

  it('observes once however often it is connected', () => {
    const { host } = mount();
    (host as unknown as { connectedCallback(): void }).connectedCallback();
    expect(observers).toHaveLength(1);
  });

  it('defines its tag once', () => {
    expect(() => defineScrollReveal()).not.toThrow();
  });
});
