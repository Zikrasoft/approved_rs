// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineRangeFilter } from './rangeFilter.ts';

let tagSeq = 0;

type Listener = () => void;

// jsdom has no media-query engine, so the breakpoint is driven by hand.
function stubViewport(matches: boolean) {
  const listeners: Listener[] = [];
  const list = {
    matches,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: () => {},
  };
  vi.stubGlobal('matchMedia', () => list);
  return {
    resizeTo(next: boolean) {
      list.matches = next;
      for (const fn of listeners) fn();
    },
  };
}

function mount(html: string, attrs = ''): HTMLElement {
  const tagName = `range-filter-${(tagSeq += 1)}`;
  defineRangeFilter(tagName);
  document.body.innerHTML = `<${tagName} ${attrs}>${html}</${tagName}>`;
  return document.body.firstElementChild as HTMLElement;
}

function shown(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('[data-filter-item]')]
    .filter((item) => !item.hasAttribute('hidden'))
    .map((item) => item.dataset.name ?? '');
}

function setRange(root: HTMLElement, value: string) {
  const range = root.querySelector<HTMLInputElement>('[data-range]')!;
  range.value = value;
  range.dispatchEvent(new Event('input'));
}

const ITEMS = `
  <div data-filter-item data-amount="80000" data-group="de" data-name="grenadier"></div>
  <div data-filter-item data-amount="29900" data-group="rs" data-name="giulia"></div>
  <div data-filter-item data-amount="16000" data-group="es" data-name="leon"></div>
`;
const RANGE =
  '<input data-range type="range" min="0" max="80000" value="80000">';

describe('defineRangeFilter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows everything within the starting ceiling', () => {
    const root = mount(RANGE + ITEMS);
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
  });

  it('drops items above the ceiling as the range moves', () => {
    const root = mount(RANGE + ITEMS);
    setRange(root, '30000');
    expect(shown(root)).toEqual(['giulia', 'leon']);
  });

  it('narrows to one group when a chip is pressed', () => {
    const root = mount(
      `${RANGE}
       <button data-filter-chip data-group="*" aria-pressed="true">all</button>
       <button data-filter-chip data-group="rs" aria-pressed="false">rs</button>
       ${ITEMS}`,
    );
    root.querySelector<HTMLButtonElement>('[data-group="rs"]')!.click();
    expect(shown(root)).toEqual(['giulia']);
    expect(
      [...root.querySelectorAll('[data-filter-chip]')].map((chip) =>
        chip.getAttribute('aria-pressed'),
      ),
    ).toEqual(['false', 'true']);
  });

  it('combines the chip and the ceiling', () => {
    const root = mount(
      `${RANGE}
       <button data-filter-chip data-group="de">de</button>
       ${ITEMS}`,
    );
    root.querySelector<HTMLButtonElement>('[data-group="de"]')!.click();
    setRange(root, '30000');
    expect(shown(root)).toEqual([]);
  });

  it('starts on the group its chip preselects', () => {
    const root = mount(
      `${RANGE}
       <button data-filter-chip data-group="es" aria-pressed="true">es</button>
       ${ITEMS}`,
    );
    expect(shown(root)).toEqual(['leon']);
  });

  it('treats a chip without a group as "all"', () => {
    const root = mount(`${RANGE}<button data-filter-chip>any</button>${ITEMS}`);
    root.querySelector<HTMLButtonElement>('[data-filter-chip]')!.click();
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
  });

  it('writes the ceiling into the output with its suffix', () => {
    const root = mount(
      `${RANGE}<span data-range-output></span>${ITEMS}`,
      'data-locale="ru-RU" data-suffix=" €"',
    );
    setRange(root, '30000');
    expect(
      root.querySelector('[data-range-output]')!.textContent!.endsWith(' €'),
    ).toBe(true);
    expect(root.querySelector('[data-range-output]')!.textContent).toContain(
      '30',
    );
  });

  it('formats the output with the default locale when none is given', () => {
    const root = mount(`${RANGE}<span data-range-output></span>${ITEMS}`);
    expect(root.querySelector('[data-range-output]')!.textContent).toBe(
      new Intl.NumberFormat().format(80000),
    );
  });

  it('fills the count template with shown and total', () => {
    const root = mount(
      `${RANGE}
       <p data-filter-count data-template="{shown} of {total}"></p>
       ${ITEMS}`,
    );
    setRange(root, '30000');
    expect(root.querySelector('[data-filter-count]')!.textContent).toBe(
      '2 of 3',
    );
  });

  it('empties the count when the template is missing', () => {
    const root = mount(`${RANGE}<p data-filter-count></p>${ITEMS}`);
    expect(root.querySelector('[data-filter-count]')!.textContent).toBe('');
  });

  it('reveals the empty message only when nothing matches', () => {
    const root = mount(
      `${RANGE}<p data-filter-empty hidden>nothing</p>${ITEMS}`,
    );
    const empty = root.querySelector('[data-filter-empty]')!;
    expect(empty.hasAttribute('hidden')).toBe(true);
    setRange(root, '100');
    expect(empty.hasAttribute('hidden')).toBe(false);
  });

  it('keeps an item whose amount is not a number at every ceiling', () => {
    const root = mount(
      `${RANGE}
       <div data-filter-item data-amount="on request" data-group="rs" data-name="quote"></div>
       ${ITEMS}`,
    );
    expect(shown(root)).toContain('quote');
    setRange(root, '1000');
    expect(shown(root)).toEqual(['quote']);
  });

  it('keeps an item with no amount at all', () => {
    const root = mount(`${RANGE}<div data-filter-item data-name="bare"></div>`);
    setRange(root, '1000');
    expect(shown(root)).toEqual(['bare']);
  });

  it('does nothing without a range input', () => {
    const root = mount(ITEMS);
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
  });

  it('does nothing without items', () => {
    const root = mount(`${RANGE}<span data-range-output></span>`);
    expect(root.querySelector('[data-range-output]')!.textContent).toBe('');
  });

  it('stops responding once removed from the document', () => {
    const root = mount(RANGE + ITEMS);
    root.remove();
    setRange(root, '100');
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
  });

  it('re-binds when the same element is reconnected', () => {
    const root = mount(RANGE + ITEMS);
    root.remove();
    document.body.append(root);
    setRange(root, '20000');
    expect(shown(root)).toEqual(['leon']);
  });

  it('caps the visible items on a narrow viewport', () => {
    stubViewport(true);
    const root = mount(
      `${RANGE}<button data-filter-more data-template="+{rest}" hidden></button>${ITEMS}`,
      'data-cap="2"',
    );
    expect(shown(root)).toEqual(['grenadier', 'giulia']);
    const more = root.querySelector('[data-filter-more]')!;
    expect(more.hasAttribute('hidden')).toBe(false);
    expect(more.textContent).toBe('+1');
  });

  it('still counts every match while the cap is on', () => {
    stubViewport(true);
    const root = mount(
      `${RANGE}<p data-filter-count data-template="{shown}/{total}"></p>${ITEMS}`,
      'data-cap="2"',
    );
    expect(root.querySelector('[data-filter-count]')!.textContent).toBe('3/3');
  });

  it('drops the cap once the rest are asked for', () => {
    stubViewport(true);
    const root = mount(
      `${RANGE}<button data-filter-more data-template="+{rest}" hidden></button>${ITEMS}`,
      'data-cap="2"',
    );
    root.querySelector<HTMLButtonElement>('[data-filter-more]')!.click();
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
    expect(
      root.querySelector('[data-filter-more]')!.hasAttribute('hidden'),
    ).toBe(true);
  });

  it('empties the more button label when its template is missing', () => {
    stubViewport(true);
    const root = mount(
      `${RANGE}<button data-filter-more hidden></button>${ITEMS}`,
      'data-cap="2"',
    );
    expect(root.querySelector('[data-filter-more]')!.textContent).toBe('');
  });

  it('ignores the cap on a wide viewport', () => {
    stubViewport(false);
    const root = mount(
      `${RANGE}<button data-filter-more data-template="+{rest}" hidden></button>${ITEMS}`,
      'data-cap="2"',
    );
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
    expect(
      root.querySelector('[data-filter-more]')!.hasAttribute('hidden'),
    ).toBe(true);
  });

  it('lets go of the cap when the viewport crosses the breakpoint', () => {
    const viewport = stubViewport(true);
    const root = mount(`${RANGE}${ITEMS}`, 'data-cap="2"');
    expect(shown(root)).toEqual(['grenadier', 'giulia']);
    viewport.resizeTo(false);
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
  });

  it('shows everything when no cap is set', () => {
    stubViewport(true);
    const root = mount(
      `${RANGE}<button data-filter-more data-template="+{rest}" hidden></button>${ITEMS}`,
    );
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
    expect(
      root.querySelector('[data-filter-more]')!.hasAttribute('hidden'),
    ).toBe(true);
  });

  it('works where matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const root = mount(`${RANGE}${ITEMS}`, 'data-cap="2"');
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
  });

  it('defines the element only once per tag name', () => {
    const tagName = `range-filter-shared-${(tagSeq += 1)}`;
    defineRangeFilter(tagName);
    const first = customElements.get(tagName);
    defineRangeFilter(tagName);
    expect(customElements.get(tagName)).toBe(first);
  });

  it('ignores a second connect while already bound', () => {
    const root = mount(RANGE + ITEMS);
    (root as unknown as { connectedCallback(): void }).connectedCallback();
    setRange(root, '20000');
    expect(shown(root)).toEqual(['leon']);
  });
});
