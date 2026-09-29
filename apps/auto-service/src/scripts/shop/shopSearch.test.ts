// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineShopSearch } from './shopSearch';

const hit = (url: string, title: string, price: string) => ({
  data: async () => ({ url, meta: { title, price } }),
});

const pagefind = {
  options: vi.fn(),
  debouncedSearch: vi.fn(),
};
const load = vi.fn();

const mount = () => {
  document.body.innerHTML = `
    <shop-search data-bundle="/pagefind/pagefind.js">
      <form role="search"><input type="search" data-search-input></form>
      <ul data-search-results></ul>
      <p data-search-empty hidden></p>
    </shop-search>`;
  return document.querySelector<HTMLInputElement>('[data-search-input]')!;
};

const type = async (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const results = () =>
  [
    ...document.querySelectorAll<HTMLAnchorElement>('[data-search-results] a'),
  ].map((a) => [a.getAttribute('href'), a.textContent]);

beforeAll(() => defineShopSearch('shop-search', load));

beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue(pagefind);
  pagefind.debouncedSearch.mockResolvedValue({
    results: [
      hit('/sr/shop/batteries/bosch-s4-024/', 'Bosch S4 024', '11.190 RSD'),
    ],
  });
});

describe('<shop-search>', () => {
  it('loads nothing until the shopper reaches for it', () => {
    mount();
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the index once on first focus', () => {
    const input = mount();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('/pagefind/pagefind.js');
  });

  it('lists matching products with their price', async () => {
    const input = mount();

    await type(input, 'S40 240');

    expect(pagefind.debouncedSearch).toHaveBeenCalledWith('S40 240');
    expect(results()).toEqual([
      ['/sr/shop/batteries/bosch-s4-024/', 'Bosch S4 02411.190 RSD'],
    ]);
  });

  it('clears on a one-letter query and shows the empty note when nothing matches', async () => {
    const input = mount();
    await type(input, 'bo');
    await type(input, 'b');
    expect(results()).toEqual([]);

    pagefind.debouncedSearch.mockResolvedValue({ results: [] });
    await type(input, 'zzz');
    expect(
      document.querySelector('[data-search-empty]')!.hasAttribute('hidden'),
    ).toBe(false);
  });

  it('ignores a search that a newer keystroke replaced', async () => {
    const input = mount();
    pagefind.debouncedSearch.mockResolvedValue(null);

    await type(input, 'bosch');

    expect(results()).toEqual([]);
  });

  it('stays usable when the index cannot be loaded', async () => {
    load.mockRejectedValue(new Error('404'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const input = mount();

    await expect(type(input, 'bosch')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
