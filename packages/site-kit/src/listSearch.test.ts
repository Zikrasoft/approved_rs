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

const INDEX = [
  { name: 'Audi', href: '/cars/audi/', picture: '/audi.jpg' },
  { name: 'BMW', href: '/cars/bmw/', picture: null },
  { name: 'Škoda', href: '/cars/skoda/', picture: '/skoda.jpg' },
  { name: 'Seat', href: '/cars/seat/' },
];

const TEMPLATE = `
  <template data-search-template>
    <li>
      <a data-search-href>
        <img data-search-picture alt="" />
        <span data-search-no-picture><b data-search-name></b></span>
        <h2 data-search-name></h2>
      </a>
    </li>
  </template>
`;

const list = (index: unknown = INDEX) => `
  <input data-search-input />
  <ul data-search-idle>
    <li>Audi</li>
    <li>BMW</li>
  </ul>
  <ul data-search-results hidden></ul>
  ${TEMPLATE}
  <script type="application/json" data-search-index>${JSON.stringify(index)}</script>
  <p data-search-empty hidden> Nothing </p>
  <p data-search-status></p>
  <nav data-search-idle>pages</nav>
`;

const results = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-search-results]')!;

const found = (root: HTMLElement) =>
  [...results(root).querySelectorAll('h2')].map((h2) => h2.textContent);

const type = (root: HTMLElement, value: string) => {
  const input = root.querySelector<HTMLInputElement>('[data-search-input]')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
};

const hidden = (root: HTMLElement, selector: string) =>
  root.querySelector<HTMLElement>(selector)!.hidden;

const idleHidden = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('[data-search-idle]')].map(
    (element) => element.hidden,
  );

describe('defineListSearch', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('matches across the whole index, not only what the page renders', () => {
    const root = mount(list());
    type(root, 's');
    expect(found(root)).toEqual(['Škoda', 'Seat']);
    expect(results(root).hidden).toBe(false);
  });

  it('ignores case, accents and surrounding spaces', () => {
    const root = mount(list());
    type(root, '  SKO ');
    expect(found(root)).toEqual(['Škoda']);
  });

  it('renders a match from the template with its link, name and picture', () => {
    const root = mount(list());
    type(root, 'audi');
    const item = results(root).firstElementChild!;
    expect(item.querySelector('a')?.getAttribute('href')).toBe('/cars/audi/');
    expect(item.querySelector('img')?.getAttribute('src')).toBe('/audi.jpg');
    expect(item.querySelector('[data-search-no-picture]')).toBeNull();
    expect(
      [...item.querySelectorAll('[data-search-name]')].map(
        (name) => name.textContent,
      ),
    ).toEqual(['Audi']);
  });

  it('renders the stand-in for a match without a picture', () => {
    const root = mount(list());
    type(root, 'bmw seat');
    type(root, 'bmw');
    const item = results(root).firstElementChild!;
    expect(item.querySelector('img')).toBeNull();
    expect(
      [...item.querySelectorAll('[data-search-name]')].map(
        (name) => name.textContent,
      ),
    ).toEqual(['BMW', 'BMW']);
    type(root, 'seat');
    expect(results(root).querySelector('img')).toBeNull();
  });

  it('hides what stands idle while a query is typed', () => {
    const root = mount(list());
    type(root, 'bmw');
    expect(idleHidden(root)).toEqual([true, true]);
    expect(hidden(root, '[data-search-empty]')).toBe(true);
  });

  it('says nothing matches when nothing does', () => {
    const root = mount(list());
    type(root, 'lada');
    expect(found(root)).toEqual([]);
    expect(hidden(root, '[data-search-empty]')).toBe(false);
  });

  it('announces that nothing matches through a status that never hides', () => {
    const root = mount(list());
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
      `<input data-search-input /><ul data-search-results></ul>${TEMPLATE}<script type="application/json" data-search-index>[]</script><p data-search-status></p>`,
    );
    type(root, 'x');
    expect(root.querySelector('[data-search-status]')!.textContent).toBe('');
  });

  it('puts the page back as it came once the query is cleared', () => {
    const root = mount(list());
    type(root, 'audi');
    type(root, ' ');
    expect(found(root)).toEqual([]);
    expect(results(root).hidden).toBe(true);
    expect(idleHidden(root)).toEqual([false, false]);
    expect(hidden(root, '[data-search-empty]')).toBe(true);
  });

  it('works without an empty state, a status or anything idle', () => {
    const root = mount(
      `<input data-search-input /><ul data-search-results></ul>${TEMPLATE}<script type="application/json" data-search-index>${JSON.stringify(INDEX)}</script>`,
    );
    type(root, 'audi');
    expect(found(root)).toEqual(['Audi']);
  });

  it('reads an empty index script as no entries', () => {
    const root = mount(
      `<input data-search-input /><ul data-search-results></ul>${TEMPLATE}<script type="application/json" data-search-index></script>`,
    );
    type(root, 'a');
    expect(found(root)).toEqual([]);
  });

  it.each([
    ['an input', 'data-search-input'],
    ['a results list', 'data-search-results'],
    ['a template', 'data-search-template'],
    ['an index', 'data-search-index'],
  ])('does nothing without %s', (_, attribute) => {
    const root = mount(list().replace(attribute, 'data-other'));
    const input = root.querySelector<HTMLInputElement>('input')!;
    input.value = 'audi';
    input.dispatchEvent(new Event('input'));
    expect(root.querySelector('ul h2')).toBeNull();
    expect(idleHidden(root)).toEqual([false, false]);
  });

  it('stops responding once removed from the document', () => {
    const root = mount(list());
    root.remove();
    type(root, 'bmw');
    expect(found(root)).toEqual([]);
  });

  it('re-binds when the same element is reconnected', () => {
    const root = mount(list());
    root.remove();
    document.body.append(root);
    type(root, 'bmw');
    expect(found(root)).toEqual(['BMW']);
  });

  it('ignores a second connect while already bound', () => {
    const root = mount(list());
    (root as unknown as { connectedCallback(): void }).connectedCallback();
    type(root, 'seat');
    expect(found(root)).toEqual(['Seat']);
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
