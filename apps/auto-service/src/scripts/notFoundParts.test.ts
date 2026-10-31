// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { defineNotFoundParts } from './notFoundParts';

defineNotFoundParts();

const render = (path: string) => {
  history.replaceState(null, '', path);
  document.body.innerHTML = `
    <not-found-parts data-parts-paths="/ru/parts/ /sr/parts/" data-part-paths="/ru/parts/p/ /sr/parts/p/">
      <p data-site-body>site</p>
      <div data-parts-404 hidden>parts</div>
    </not-found-parts>`;
  return {
    site: document.querySelector<HTMLElement>('[data-site-body]')!,
    parts: document.querySelector<HTMLElement>('[data-parts-404]')!,
  };
};

describe('<not-found-parts>', () => {
  it('offers the parts search on a missing parts page', () => {
    const { site, parts } = render('/sr/parts/p/gone/');
    expect([site.hidden, parts.hidden]).toEqual([true, false]);
  });

  it('sends an upper-case part slug to its lower-case page', () => {
    const replace = vi.fn();
    vi.stubGlobal('location', {
      pathname: '/ru/parts/p/MANN-FILTER-HU816X/',
      search: '?vin=1',
      hash: '',
      replace,
    });
    try {
      document.body.innerHTML =
        '<not-found-parts data-part-paths="/ru/parts/p/"></not-found-parts>';
      expect(replace).toHaveBeenCalledWith(
        '/ru/parts/p/mann-filter-hu816x/?vin=1',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the site copy on any other missing page', () => {
    const { site, parts } = render('/sr/services/gone/');
    expect([site.hidden, parts.hidden]).toEqual([false, true]);
  });
});
