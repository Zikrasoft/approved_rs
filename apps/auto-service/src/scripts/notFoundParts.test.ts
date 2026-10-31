// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defineNotFoundParts } from './notFoundParts';

defineNotFoundParts();

const render = (path: string) => {
  history.replaceState(null, '', path);
  document.body.innerHTML = `
    <not-found-parts data-parts-paths="/ru/parts/ /sr/parts/">
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

  it('keeps the site copy on any other missing page', () => {
    const { site, parts } = render('/sr/services/gone/');
    expect([site.hidden, parts.hidden]).toEqual([false, true]);
  });
});
