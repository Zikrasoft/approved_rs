// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  definePartsBrowse,
  PARTS_BROWSE_ATTRIBUTE,
  PARTS_BROWSE_SOURCE_ATTRIBUTE,
  PARTS_BROWSE_STATUS_ATTRIBUTE,
} from './partsBrowse';

const navigate = vi.fn();
definePartsBrowse('test-parts-browse', navigate);

const block = (page: number, status = `page ${page}`) => `
  <div ${PARTS_BROWSE_ATTRIBUTE} ${PARTS_BROWSE_STATUS_ATTRIBUTE}="${status}">
    <ul><li><a href="/ru/parts/p${page}/">part ${page}</a></li></ul>
    <nav>
      <a rel="prev" href="/ru/parts/search/">prev</a>
      <a rel="next" href="/ru/parts/search/?offset=${page * 12}">next</a>
    </nav>
  </div>`;

const mount = () => {
  document.body.innerHTML = `
    <test-parts-browse ${PARTS_BROWSE_SOURCE_ATTRIBUTE}="/ru/parts/search/">
      <h2 tabindex="-1">All parts</h2>
      <p aria-live="polite"></p>
      ${block(1)}
    </test-parts-browse>`;
  return document.querySelector('test-parts-browse')!;
};

const answer = (body: string, ok = true) =>
  vi.fn(async () => ({ ok, text: async () => body }));

const click = (target: Element, init: MouseEventInit = {}) => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const nextLink = () => document.querySelector('a[rel="next"]')!;

beforeEach(() => {
  navigate.mockReset();
  window.history.replaceState(null, '', '/ru/parts/');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the parts browse', () => {
  it('swaps in the next page of the search page, announces it and moves focus to the heading', async () => {
    const fetch = answer(
      `<html><body><main>${block(2, 'Parts 13 to 24 of 30')}</main></body></html>`,
    );
    vi.stubGlobal('fetch', fetch);
    const element = mount();

    const event = click(nextLink());
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/ru/parts/search/?offset=12',
      { headers: { accept: 'text/html' } },
    );
    expect(element.querySelector('ul')!.textContent).toContain('part 2');
    expect(
      element.querySelectorAll(`[${PARTS_BROWSE_ATTRIBUTE}]`),
    ).toHaveLength(1);
    expect(element.querySelector('[aria-live]')!.textContent).toBe(
      'Parts 13 to 24 of 30',
    );
    expect(document.activeElement).toBe(element.querySelector('h2'));
    expect(navigate).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe(
      '/ru/parts/?offset=12',
    );
  });

  it('remembers the first page without an offset', async () => {
    window.history.replaceState(null, '', '/ru/parts/?offset=12');
    vi.stubGlobal('fetch', answer(block(1)));
    document.body.innerHTML = `<test-parts-browse>${block(2)}</test-parts-browse>`;

    click(document.querySelector('a[rel="prev"]')!);
    await settle();

    expect(window.location.pathname + window.location.search).toBe(
      '/ru/parts/',
    );
  });

  it('opens on the page the address remembers, without taking focus', async () => {
    window.history.replaceState(null, '', '/ru/parts/?offset=24');
    const fetch = answer(block(3, 'Parts 25 to 30 of 30'));
    vi.stubGlobal('fetch', fetch);

    const element = mount();
    await settle();

    expect(fetch).toHaveBeenCalledWith('/ru/parts/search/?offset=24', {
      headers: { accept: 'text/html' },
    });
    expect(element.querySelector('ul')!.textContent).toContain('part 3');
    expect(document.activeElement).not.toBe(element.querySelector('h2'));
  });

  it('follows the history back and forth', async () => {
    vi.stubGlobal('fetch', answer(block(2)));
    const element = mount();
    click(nextLink());
    await settle();
    const fetch = answer(block(1));
    vi.stubGlobal('fetch', fetch);

    window.history.replaceState(null, '', '/ru/parts/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await settle();

    expect(fetch).toHaveBeenCalledWith('/ru/parts/search/', {
      headers: { accept: 'text/html' },
    });
    expect(element.querySelector('ul')!.textContent).toContain('part 1');
  });

  it('opens the remembered page itself when it cannot be loaded in place', async () => {
    window.history.replaceState(null, '', '/ru/parts/?offset=24');
    vi.stubGlobal('fetch', answer('', false));

    mount();
    await settle();

    expect(navigate).toHaveBeenCalledWith('/ru/parts/search/?offset=24');
  });

  it('stops following the history once it leaves the page', async () => {
    const fetch = answer(block(2));
    vi.stubGlobal('fetch', fetch);
    mount().remove();

    window.dispatchEvent(new PopStateEvent('popstate'));
    await settle();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('follows the history once when it is put back', async () => {
    const fetch = answer(block(2));
    vi.stubGlobal('fetch', fetch);
    const element = mount();
    const parent = element.parentElement!;
    parent.append(element);

    window.dispatchEvent(new PopStateEvent('popstate'));
    await settle();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores the history without a page to load from', async () => {
    const fetch = answer(block(2));
    vi.stubGlobal('fetch', fetch);
    window.history.replaceState(null, '', '/ru/parts/?offset=12');
    document.body.innerHTML = `<test-parts-browse>${block(1)}</test-parts-browse>`;
    await settle();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('has nothing to restore without a parts list', async () => {
    const fetch = answer(block(2));
    vi.stubGlobal('fetch', fetch);
    window.history.replaceState(null, '', '/ru/parts/?offset=12');
    document.body.innerHTML = `<test-parts-browse ${PARTS_BROWSE_SOURCE_ATTRIBUTE}="/ru/parts/search/"></test-parts-browse>`;
    await settle();

    expect(fetch).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps turning pages on the links the swapped page brought', async () => {
    vi.stubGlobal('fetch', answer(block(2)));
    mount();
    click(nextLink());
    await settle();
    const fetch = answer(block(3));
    vi.stubGlobal('fetch', fetch);

    click(nextLink());
    await settle();

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/ru/parts/search/?offset=24',
      expect.anything(),
    );
    expect(document.querySelector('ul')!.textContent).toContain('part 3');
  });

  it.each([
    ['answers an error', answer('', false)],
    [
      'cannot be reached',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    ],
    ['has no parts list', answer('<html><body><p>nothing</p></body></html>')],
  ])('navigates to the page when it %s', async (_, fetch) => {
    vi.stubGlobal('fetch', fetch);
    mount();

    click(nextLink());
    await settle();

    expect(navigate).toHaveBeenCalledWith(
      'http://localhost:3000/ru/parts/search/?offset=12',
    );
    expect(document.querySelector('ul')!.textContent).toContain('part 1');
  });

  it('ignores a second click while a page is loading', async () => {
    const fetch = answer(block(2));
    vi.stubGlobal('fetch', fetch);
    mount();

    click(nextLink());
    const second = click(nextLink());
    await settle();

    expect(second.defaultPrevented).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a part link', () => document.querySelector('ul a')!, {}],
    ['a page link opened in a new tab', nextLink, { ctrlKey: true }],
    ['a page link opened in a new window', nextLink, { shiftKey: true }],
    ['a page link saved with alt', nextLink, { altKey: true }],
    ['a page link opened with meta', nextLink, { metaKey: true }],
    ['a middle click on a page link', nextLink, { button: 1 }],
  ])('leaves %s to the browser', async (_, target, init) => {
    const fetch = answer(block(2));
    vi.stubGlobal('fetch', fetch);
    mount();

    const event = click(target(), init);
    await settle();

    expect(event.defaultPrevented).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('leaves a click that reaches it from no element', async () => {
    const fetch = answer(block(2));
    vi.stubGlobal('fetch', fetch);
    const element = mount();
    const text = document.createTextNode('loose');
    element.append(text);

    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('leaves a click another handler already took', async () => {
    const fetch = answer(block(2));
    vi.stubGlobal('fetch', fetch);
    mount();
    nextLink().addEventListener('click', (event) => event.preventDefault());

    click(nextLink());
    await settle();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does nothing without a parts list to swap', async () => {
    const fetch = answer(block(2));
    vi.stubGlobal('fetch', fetch);
    document.body.innerHTML =
      '<test-parts-browse><a rel="next" href="/x/">next</a></test-parts-browse>';

    click(nextLink());
    await settle();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('swaps without a live region or a heading to focus', async () => {
    vi.stubGlobal('fetch', answer(block(2)));
    document.body.innerHTML = `<test-parts-browse>${block(1)}</test-parts-browse>`;

    click(nextLink());
    await settle();

    expect(document.querySelector('ul')!.textContent).toContain('part 2');
  });

  it('defines the element once', () => {
    expect(() => definePartsBrowse('test-parts-browse')).not.toThrow();
  });

  it('navigates by default', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    vi.stubGlobal('fetch', answer('', false));
    definePartsBrowse('default-parts-browse');
    document.body.innerHTML = `<default-parts-browse>${block(1)}</default-parts-browse>`;

    click(nextLink());
    await settle();

    expect(assign).toHaveBeenCalled();
  });
});
