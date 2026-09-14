// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineZoneMap, type ZoneMapOptions } from './zoneMap.ts';

let tagSeq = 0;
let observers: FakeObserver[] = [];
let reducedMotion = false;

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

class FakeObserver {
  disconnected = false;
  constructor(public callback: ObserverCallback) {
    observers.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
}

function inView(value: boolean) {
  observers.at(-1)!.callback([{ isIntersecting: value }]);
}

function mount(html: string, options?: ZoneMapOptions): HTMLElement {
  const tagName = `zone-map-${(tagSeq += 1)}`;
  defineZoneMap(tagName, options);
  document.body.innerHTML = `<${tagName}>${html}</${tagName}>`;
  return document.body.firstElementChild as HTMLElement;
}

function pressed(root: HTMLElement): (string | null)[] {
  return [...root.querySelectorAll('[data-zone]')].map((button) =>
    button.getAttribute('aria-pressed'),
  );
}

function visible(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('[data-zone-panel]')]
    .filter((panel) => !panel.hasAttribute('hidden'))
    .map((panel) => panel.dataset.zonePanel ?? '');
}

const MARKUP = `
  <button data-zone="body">1</button>
  <button data-zone="engine">2</button>
  <div data-zone-panel="body">body</div>
  <div data-zone-panel="engine">engine</div>
`;

describe('defineZoneMap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    observers = [];
    reducedMotion = false;
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens the first zone when none is preselected', () => {
    const root = mount(MARKUP);
    expect(pressed(root)).toEqual(['true', 'false']);
    expect(visible(root)).toEqual(['body']);
  });

  it('honours the zone preselected in the markup', () => {
    const root = mount(`
      <button data-zone="body">1</button>
      <button data-zone="engine" aria-pressed="true">2</button>
      <div data-zone-panel="body">body</div>
      <div data-zone-panel="engine">engine</div>
    `);
    expect(pressed(root)).toEqual(['false', 'true']);
    expect(visible(root)).toEqual(['engine']);
  });

  it('switches zones on click', () => {
    const root = mount(MARKUP);
    root.querySelector<HTMLButtonElement>('[data-zone="engine"]')!.click();
    expect(pressed(root)).toEqual(['false', 'true']);
    expect(visible(root)).toEqual(['engine']);
  });

  it('treats a button without a zone value as the empty zone', () => {
    const root = mount(`
      <button data-zone>1</button>
      <div data-zone-panel="">blank</div>
    `);
    expect(visible(root)).toEqual(['']);
    root.querySelector<HTMLButtonElement>('[data-zone]')!.click();
    expect(visible(root)).toEqual(['']);
  });

  it('does nothing without zone buttons', () => {
    const root = mount('<div data-zone-panel="body">body</div>');
    expect(visible(root)).toEqual(['body']);
  });

  it('works without panels', () => {
    const root = mount('<button data-zone="body">1</button>');
    expect(pressed(root)).toEqual(['true']);
  });

  it('stops responding once removed from the document', () => {
    const root = mount(MARKUP);
    const engine = root.querySelector<HTMLButtonElement>(
      '[data-zone="engine"]',
    )!;
    root.remove();
    engine.click();
    expect(pressed(root)).toEqual(['true', 'false']);
  });

  it('re-binds when the same element is reconnected', () => {
    const root = mount(MARKUP);
    root.remove();
    document.body.append(root);
    root.querySelector<HTMLButtonElement>('[data-zone="engine"]')!.click();
    expect(visible(root)).toEqual(['engine']);
  });

  it('defines the element only once per tag name', () => {
    const tagName = `zone-map-shared-${(tagSeq += 1)}`;
    defineZoneMap(tagName);
    const first = customElements.get(tagName);
    defineZoneMap(tagName);
    expect(customElements.get(tagName)).toBe(first);
  });

  it('ignores a second connect while already bound', () => {
    const root = mount(MARKUP);
    (root as unknown as { connectedCallback(): void }).connectedCallback();
    root.querySelector<HTMLButtonElement>('[data-zone="engine"]')!.click();
    expect(pressed(root)).toEqual(['false', 'true']);
  });

  it('walks through the zones on its own once the map is in view', () => {
    const root = mount(MARKUP, { interval: 1000 });
    expect(visible(root)).toEqual(['body']);

    inView(true);
    vi.advanceTimersByTime(1000);
    expect(visible(root)).toEqual(['engine']);

    vi.advanceTimersByTime(1000);
    expect(visible(root)).toEqual(['body']);
  });

  it('hands over for good once the visitor picks a zone', () => {
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);

    root.querySelector<HTMLButtonElement>('[data-zone="engine"]')!.click();
    vi.advanceTimersByTime(5000);

    expect(visible(root)).toEqual(['engine']);
  });

  it('does not resume after the pointer leaves a zone the visitor picked', () => {
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);

    root.querySelector<HTMLButtonElement>('[data-zone="engine"]')!.click();
    root.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(5000);

    expect(visible(root)).toEqual(['engine']);
  });

  it('does not resume when a picked zone scrolls back into view', () => {
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);

    root.querySelector<HTMLButtonElement>('[data-zone="engine"]')!.click();
    inView(false);
    inView(true);
    vi.advanceTimersByTime(5000);

    expect(visible(root)).toEqual(['engine']);
  });

  it('continues from the zone the visitor was last shown', () => {
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);
    vi.advanceTimersByTime(1000);
    inView(false);
    inView(true);

    vi.advanceTimersByTime(1000);

    expect(visible(root)).toEqual(['body']);
  });

  it('stands still while the map is scrolled out of view', () => {
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);
    inView(false);

    vi.advanceTimersByTime(5000);

    expect(visible(root)).toEqual(['body']);
  });

  it('waits while the pointer rests on the map', () => {
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);

    root.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(5000);
    expect(visible(root)).toEqual(['body']);

    root.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(1000);
    expect(visible(root)).toEqual(['engine']);
  });

  it('waits while focus is inside the map', () => {
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);

    root.dispatchEvent(new Event('focusin'));
    vi.advanceTimersByTime(5000);
    expect(visible(root)).toEqual(['body']);

    root.dispatchEvent(new Event('focusout'));
    vi.advanceTimersByTime(1000);
    expect(visible(root)).toEqual(['engine']);
  });

  it('never starts a second timer on repeated resume', () => {
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);
    inView(true);

    vi.advanceTimersByTime(1000);

    expect(visible(root)).toEqual(['engine']);
  });

  it('stays put when the walkthrough is switched off', () => {
    const root = mount(MARKUP, { interval: 0 });

    vi.advanceTimersByTime(10000);

    expect(visible(root)).toEqual(['body']);
  });

  it('watches nothing when the walkthrough is switched off', () => {
    mount(MARKUP, { interval: 0 });

    expect(observers).toEqual([]);
  });

  it('still switches zones on click with the walkthrough off', () => {
    const root = mount(MARKUP, { interval: 0 });

    root.querySelectorAll<HTMLButtonElement>('[data-zone]')[1].click();

    expect(visible(root)).toEqual(['engine']);
  });

  it('stays put for a visitor who asked for reduced motion', () => {
    reducedMotion = true;
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);

    vi.advanceTimersByTime(10000);

    expect(visible(root)).toEqual(['body']);
  });

  it('survives a browser with no matchMedia at all', () => {
    vi.stubGlobal('matchMedia', undefined);
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);

    vi.advanceTimersByTime(1000);

    expect(visible(root)).toEqual(['engine']);
  });

  it('drops its timer and observer when removed from the document', () => {
    const root = mount(MARKUP, { interval: 1000 });
    inView(true);
    const observer = observers.at(-1)!;

    root.remove();
    vi.advanceTimersByTime(5000);

    expect(observer.disconnected).toBe(true);
    expect(visible(root)).toEqual(['body']);
  });

  it('ignores an intersection entry that never arrived', () => {
    const root = mount(MARKUP, { interval: 1000 });
    observers.at(-1)!.callback([]);

    vi.advanceTimersByTime(5000);

    expect(visible(root)).toEqual(['body']);
  });
});
