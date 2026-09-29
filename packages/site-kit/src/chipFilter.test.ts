// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { defineChipFilter } from './chipFilter.ts';

let tagSeq = 0;

function mount(html: string, attrs = ''): HTMLElement {
  const tagName = `chip-filter-${(tagSeq += 1)}`;
  defineChipFilter(tagName);
  document.body.innerHTML = `<${tagName} ${attrs}>${html}</${tagName}>`;
  return document.body.firstElementChild as HTMLElement;
}

function shown(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('[data-filter-item]')]
    .filter((item) => !item.hasAttribute('hidden'))
    .map((item) => item.dataset.name ?? '');
}

const ITEMS = `
  <div data-filter-item data-group="de" data-name="grenadier"></div>
  <div data-filter-item data-group="rs" data-name="giulia"></div>
  <div data-filter-item data-group="es" data-name="leon"></div>
`;
const MORE =
  '<button data-filter-more data-template="+{rest}" hidden></button>';

describe('defineChipFilter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows every item with no chip pressed', () => {
    const root = mount(ITEMS);
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
  });

  it('narrows to one group when a chip is pressed', () => {
    const root = mount(
      `<button data-filter-chip data-group="*" aria-pressed="true">all</button>
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

  it('starts on the group its chip preselects', () => {
    const root = mount(
      `<button data-filter-chip data-group="es" aria-pressed="true">es</button>
       ${ITEMS}`,
    );
    expect(shown(root)).toEqual(['leon']);
  });

  it('treats a chip without a group as "all"', () => {
    const root = mount(`<button data-filter-chip>any</button>${ITEMS}`);
    root.querySelector<HTMLButtonElement>('[data-filter-chip]')!.click();
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
  });

  it('does nothing without items', () => {
    const root = mount(MORE);
    expect(root.querySelector('[data-filter-more]')!.textContent).toBe('');
  });

  it('stops responding once removed from the document', () => {
    const root = mount(
      `<button data-filter-chip data-group="rs">rs</button>${ITEMS}`,
    );
    root.remove();
    root.querySelector<HTMLButtonElement>('[data-group="rs"]')!.click();
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
  });

  it('re-binds when the same element is reconnected', () => {
    const root = mount(
      `<button data-filter-chip data-group="rs">rs</button>${ITEMS}`,
    );
    root.remove();
    document.body.append(root);
    root.querySelector<HTMLButtonElement>('[data-group="rs"]')!.click();
    expect(shown(root)).toEqual(['giulia']);
  });

  it('caps the visible items and offers the rest', () => {
    const root = mount(MORE + ITEMS, 'data-cap="2"');
    expect(shown(root)).toEqual(['grenadier', 'giulia']);
    const more = root.querySelector('[data-filter-more]')!;
    expect(more.hasAttribute('hidden')).toBe(false);
    expect(more.textContent).toBe('+1');
  });

  it('drops the cap once the rest are asked for', () => {
    const root = mount(MORE + ITEMS, 'data-cap="2"');
    root.querySelector<HTMLButtonElement>('[data-filter-more]')!.click();
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
    expect(
      root.querySelector('[data-filter-more]')!.hasAttribute('hidden'),
    ).toBe(true);
  });

  it('counts the rest within the pressed group only', () => {
    const root = mount(
      `<button data-filter-chip data-group="de">de</button>${MORE}${ITEMS}`,
      'data-cap="1"',
    );
    expect(root.querySelector('[data-filter-more]')!.textContent).toBe('+2');
    root.querySelector<HTMLButtonElement>('[data-group="de"]')!.click();
    expect(shown(root)).toEqual(['grenadier']);
    expect(
      root.querySelector('[data-filter-more]')!.hasAttribute('hidden'),
    ).toBe(true);
  });

  it('empties the more button label when its template is missing', () => {
    const root = mount(
      `<button data-filter-more hidden></button>${ITEMS}`,
      'data-cap="2"',
    );
    expect(root.querySelector('[data-filter-more]')!.textContent).toBe('');
  });

  it('shows everything when no cap is set', () => {
    const root = mount(MORE + ITEMS);
    expect(shown(root)).toEqual(['grenadier', 'giulia', 'leon']);
    expect(
      root.querySelector('[data-filter-more]')!.hasAttribute('hidden'),
    ).toBe(true);
  });

  it('defines the element only once per tag name', () => {
    const tagName = `chip-filter-shared-${(tagSeq += 1)}`;
    defineChipFilter(tagName);
    const first = customElements.get(tagName);
    defineChipFilter(tagName);
    expect(customElements.get(tagName)).toBe(first);
  });

  it('ignores a second connect while already bound', () => {
    const root = mount(
      `<button data-filter-chip data-group="es">es</button>${ITEMS}`,
    );
    (root as unknown as { connectedCallback(): void }).connectedCallback();
    root.querySelector<HTMLButtonElement>('[data-group="es"]')!.click();
    expect(shown(root)).toEqual(['leon']);
  });
});
