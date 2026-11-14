// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { defineListSearch } from './listSearch.ts';

let tagSeq = 0;

function mount(html: string): HTMLElement {
  const tagName = `list-search-${(tagSeq += 1)}`;
  defineListSearch(tagName);
  document.body.innerHTML = `<${tagName}>${html}</${tagName}>`;
  return document.body.firstElementChild as HTMLElement;
}

const LIST = `
  <input data-search-input />
  <ul>
    <li data-search-item>Audi</li>
    <li data-search-item>BMW</li>
    <li data-search-item hidden>Škoda</li>
    <li data-search-item hidden>Seat</li>
  </ul>
  <p data-search-empty hidden> Nothing </p>
  <p data-search-status></p>
  <nav data-search-idle>pages</nav>
`;

const shown = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('[data-search-item]')]
    .filter((item) => !item.hidden)
    .map((item) => item.textContent);

const type = (root: HTMLElement, value: string) => {
  const input = root.querySelector<HTMLInputElement>('[data-search-input]')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
};

const hidden = (root: HTMLElement, selector: string) =>
  root.querySelector<HTMLElement>(selector)!.hidden;

describe('defineListSearch', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('matches across the whole list, hidden items included', () => {
    const root = mount(LIST);
    type(root, 's');
    expect(shown(root)).toEqual(['Škoda', 'Seat']);
  });

  it('ignores case, accents and surrounding spaces', () => {
    const root = mount(LIST);
    type(root, '  SKO ');
    expect(shown(root)).toEqual(['Škoda']);
  });

  it('hides what stands idle while a query is typed', () => {
    const root = mount(LIST);
    type(root, 'bmw');
    expect(hidden(root, '[data-search-idle]')).toBe(true);
    expect(hidden(root, '[data-search-empty]')).toBe(true);
  });

  it('says nothing matches when nothing does', () => {
    const root = mount(LIST);
    type(root, 'lada');
    expect(shown(root)).toEqual([]);
    expect(hidden(root, '[data-search-empty]')).toBe(false);
  });

  it('announces that nothing matches through a status that never hides', () => {
    const root = mount(LIST);
    const status = root.querySelector<HTMLElement>('[data-search-status]')!;
    type(root, 'lada');
    expect(status.textContent).toBe('Nothing');
    expect(status.hidden).toBe(false);
    type(root, 'bmw');
    expect(status.textContent).toBe('');
    type(root, 'lada');
    type(root, '');
    expect(status.textContent).toBe('');
  });

  it('announces nothing without an empty state to read from', () => {
    const root = mount(
      '<input data-search-input /><p data-search-status></p><p data-search-item>Audi</p>',
    );
    type(root, 'x');
    expect(root.querySelector('[data-search-status]')!.textContent).toBe('');
  });

  it('puts the list back as it came once the query is cleared', () => {
    const root = mount(LIST);
    type(root, 'lada');
    type(root, ' ');
    expect(shown(root)).toEqual(['Audi', 'BMW']);
    expect(hidden(root, '[data-search-idle]')).toBe(false);
    expect(hidden(root, '[data-search-empty]')).toBe(true);
  });

  it('works without an empty state or anything idle', () => {
    const root = mount(
      '<input data-search-input /><p data-search-item>Audi</p>',
    );
    type(root, 'x');
    expect(shown(root)).toEqual([]);
  });

  it('reads an item with no text as matching nothing', () => {
    const root = mount('<input data-search-input />');
    root.remove();
    const item = document.createElement('p');
    item.dataset.searchItem = '';
    Object.defineProperty(item, 'textContent', { get: () => null });
    root.append(item);
    document.body.append(root);
    type(root, 'a');
    expect(item.hidden).toBe(true);
  });

  it('does nothing without an input', () => {
    const root = mount('<p data-search-item hidden>Audi</p>');
    expect(shown(root)).toEqual([]);
  });

  it('stops responding once removed from the document', () => {
    const root = mount(LIST);
    root.remove();
    type(root, 'bmw');
    expect(shown(root)).toEqual(['Audi', 'BMW']);
  });

  it('re-binds when the same element is reconnected', () => {
    const root = mount(LIST);
    root.remove();
    document.body.append(root);
    type(root, 'bmw');
    expect(shown(root)).toEqual(['BMW']);
  });

  it('ignores a second connect while already bound', () => {
    const root = mount(LIST);
    (root as unknown as { connectedCallback(): void }).connectedCallback();
    type(root, 'seat');
    type(root, '');
    expect(shown(root)).toEqual(['Audi', 'BMW']);
  });

  it('defines the element only once per tag name', () => {
    const tagName = `list-search-shared-${(tagSeq += 1)}`;
    defineListSearch(tagName);
    const first = customElements.get(tagName);
    defineListSearch(tagName);
    expect(customElements.get(tagName)).toBe(first);
  });

  it('defines list-search by default', () => {
    defineListSearch();
    expect(customElements.get('list-search')).toBeDefined();
  });
});
