// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineCtaReveal } from './ctaReveal.ts';

let tagSeq = 0;
let observers: FakeObserver[] = [];

type ObserverCallback = (
  entries: { target: Element; isIntersecting: boolean }[],
) => void;

class FakeObserver {
  observed: Element[] = [];
  disconnected = false;
  constructor(public callback: ObserverCallback) {
    observers.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
}

function report(pairs: [Element, boolean][]) {
  observers.at(-1)!.callback(
    pairs.map(([target, isIntersecting]) => ({
      target,
      isIntersecting,
    })),
  );
}

function mount(watch: string | null, ctaHtml = '<a class="cta">go</a>') {
  const tagName = `cta-reveal-${(tagSeq += 1)}`;
  defineCtaReveal(tagName);
  const attr = watch === null ? '' : ` watch="${watch}"`;
  document.body.innerHTML = `${ctaHtml}<${tagName}${attr}></${tagName}>`;
  return document.body.querySelector(tagName) as HTMLElement;
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('defineCtaReveal', () => {
  it('stays hidden while a watched CTA is on screen', () => {
    const host = mount('.cta');
    const cta = document.querySelector('.cta')!;
    expect(host.dataset.revealed).toBe('false');

    report([[cta, true]]);
    expect(host.dataset.revealed).toBe('false');
  });

  it('reveals once every watched CTA has left the screen', () => {
    const host = mount('.cta');
    const cta = document.querySelector('.cta')!;

    report([[cta, true]]);
    report([[cta, false]]);
    expect(host.dataset.revealed).toBe('true');
  });

  it('stays hidden while any one of several CTAs is still visible', () => {
    const host = mount('.cta', '<a class="cta">a</a><a class="cta">b</a>');
    const [first, second] = [...document.querySelectorAll('.cta')];

    report([
      [first, true],
      [second, true],
    ]);
    report([[first, false]]);
    expect(host.dataset.revealed).toBe('false');

    report([[second, false]]);
    expect(host.dataset.revealed).toBe('true');
  });

  it('observes every element the selector matches', () => {
    mount('.cta', '<a class="cta">a</a><a class="cta">b</a>');
    expect(observers.at(-1)!.observed).toHaveLength(2);
  });

  it('reveals immediately when the selector matches nothing', () => {
    const host = mount('.missing');
    expect(host.dataset.revealed).toBe('true');
    expect(observers).toHaveLength(0);
  });

  it('reveals immediately when no watch attribute is set', () => {
    const host = mount(null);
    expect(host.dataset.revealed).toBe('true');
    expect(observers).toHaveLength(0);
  });

  it('reveals immediately where IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const host = mount('.cta');
    expect(host.dataset.revealed).toBe('true');
  });

  it('disconnects the observer when removed from the document', () => {
    const host = mount('.cta');
    host.remove();
    expect(observers.at(-1)!.disconnected).toBe(true);
  });

  it('re-observes after being reconnected', () => {
    const host = mount('.cta');
    host.remove();
    document.body.append(host);
    expect(observers).toHaveLength(2);
    expect(observers.at(-1)!.disconnected).toBe(false);
  });

  it('forgets a CTA that was visible before it left the DOM', () => {
    const host = mount('.cta');
    const gone = document.querySelector('.cta')!;
    report([[gone, true]]);

    host.remove();
    gone.remove();
    document.body.insertAdjacentHTML('afterbegin', '<a class="cta">new</a>');
    document.body.append(host);

    report([[document.querySelector('.cta')!, false]]);
    expect(host.dataset.revealed).toBe('true');
  });

  it('registers a tag name only once', () => {
    const tagName = `cta-reveal-${(tagSeq += 1)}`;
    defineCtaReveal(tagName);
    expect(() => defineCtaReveal(tagName)).not.toThrow();
  });

  it('ignores a second connect while already observing', () => {
    const host = mount('.cta');
    (
      host as HTMLElement & { connectedCallback?: () => void }
    ).connectedCallback?.();
    expect(observers).toHaveLength(1);
  });
});
