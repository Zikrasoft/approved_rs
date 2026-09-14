import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mapEmbedSrc, defineLazyMapEmbed } from './mapEmbed.ts';

type FakeEntry = { isIntersecting: boolean };
type FakeObserverCallback = (
  entries: FakeEntry[],
  observer: { disconnect: () => void },
) => void;
class FakeIntersectionObserver {
  targets: unknown[] = [];
  disconnected = false;
  constructor(
    public callback: FakeObserverCallback,
    public options: unknown,
  ) {
    observers.push(this);
  }
  observe(target: unknown) {
    this.targets.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeHTMLElement {
  dataset: Record<string, string> = {};
  children: Record<string, string>[] = [];
  replaceChildren(...nodes: Record<string, string>[]) {
    this.children = nodes;
  }
}

type MountedElement = FakeHTMLElement & { connectedCallback(): void };

let observers: FakeIntersectionObserver[];
let registry: Map<string, new () => FakeHTMLElement>;

beforeEach(() => {
  observers = [];
  registry = new Map();
  vi.stubGlobal('HTMLElement', FakeHTMLElement);
  vi.stubGlobal('customElements', {
    get: (name: string) => registry.get(name),
    define: (name: string, ctor: new () => FakeHTMLElement) =>
      void registry.set(name, ctor),
  });
  vi.stubGlobal('document', {
    createElement: () => ({}) as Record<string, string>,
  });
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mount(
  dataset: Record<string, string> = {},
  tagName = 'lazy-map-embed',
): MountedElement {
  defineLazyMapEmbed(tagName);
  const Ctor = registry.get(tagName)!;
  const element = new Ctor() as MountedElement;
  Object.assign(element.dataset, dataset);
  element.connectedCallback();
  return element;
}

describe('mapEmbedSrc', () => {
  it('pins the map by coordinates', () => {
    expect(mapEmbedSrc({ lat: 44.8125, lon: 20.4612 })).toBe(
      'https://www.google.com/maps?q=44.8125%2C20.4612&output=embed',
    );
  });

  it('escapes a text query', () => {
    expect(mapEmbedSrc('Bulevar 1, Beograd')).toBe(
      'https://www.google.com/maps?q=Bulevar%201%2C%20Beograd&output=embed',
    );
  });
});

describe('defineLazyMapEmbed', () => {
  it('registers under a custom tag name and is idempotent', () => {
    defineLazyMapEmbed();
    const first = registry.get('lazy-map-embed');
    defineLazyMapEmbed();
    expect(registry.get('lazy-map-embed')).toBe(first);

    defineLazyMapEmbed('brand-map');
    expect(registry.get('brand-map')).toBeDefined();
  });

  it('observes the element with a preload margin instead of loading at once', () => {
    const element = mount({ src: 'https://maps.example/embed' });
    expect(element.children).toHaveLength(0);
    expect(observers[0]!.targets).toEqual([element]);
    expect(observers[0]!.options).toEqual({ rootMargin: '200px' });
  });

  it('does nothing while the element is out of view', () => {
    const element = mount({ src: 'https://maps.example/embed' });
    const observer = observers[0]!;
    observer.callback([], observer);
    observer.callback([{ isIntersecting: false }], observer);
    expect(element.children).toHaveLength(0);
    expect(observer.disconnected).toBe(false);
  });

  it('inserts the iframe once the element scrolls into view', () => {
    const element = mount({
      src: 'https://maps.example/embed',
      title: 'Studio location',
      iframeClass: 'block h-full w-full border-0',
    });
    const observer = observers[0]!;
    observer.callback([{ isIntersecting: true }], observer);

    expect(element.children).toEqual([
      {
        src: 'https://maps.example/embed',
        title: 'Studio location',
        className: 'block h-full w-full border-0',
        width: '100%',
        height: '100%',
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
      },
    ]);
    expect(observer.disconnected).toBe(true);
  });

  it('falls back to empty attributes when the wrapper sets no data', () => {
    const element = mount();
    const observer = observers[0]!;
    observer.callback([{ isIntersecting: true }], observer);

    expect(element.children[0]).toMatchObject({
      src: '',
      title: '',
      className: '',
    });
  });
});
