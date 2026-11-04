import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { defineLazyMapEmbed } from '@podbor/site-kit/browser';
import MapEmbed from './MapEmbed.astro';
import { render } from './renderAstro';

const mapBox = (props: Record<string, unknown> = {}) =>
  render(MapEmbed, {
    path: '/ru/contact/',
    props: { title: 'Как доехать', ...props },
  });

describe('MapEmbed', () => {
  it('lazily embeds the garage map in the box the caller sizes', async () => {
    const root = await mapBox({ class: 'h-64' });
    const map = root.querySelector<HTMLElement>('carlab-map')!;

    expect(map.dataset.src).toContain('google.com/maps');
    expect(map.dataset.title).toBe('Как доехать');
    expect(map.parentElement?.classList.contains('h-64')).toBe(true);
  });

  it('shows the address and a Google Maps link under the embed', async () => {
    const link = (await mapBox()).querySelector('div > a')!;

    expect(link.getAttribute('href')).toBe(
      'https://maps.google.com/?cid=4988774890072933706',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.textContent).toContain('Jovana Ćirilova 23a, Zvezdara');
    expect(link.textContent).toContain('Открыть в Google Maps');
  });

  it('keeps the Google Maps link once the embed loads, so a blocked map still leads somewhere', async () => {
    const { window } = new JSDOM('<!doctype html><body></body>');
    const intersect: IntersectionObserverCallback[] = [];
    vi.stubGlobal('document', window.document);
    vi.stubGlobal('customElements', window.customElements);
    vi.stubGlobal('HTMLElement', window.HTMLElement);
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersect.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    defineLazyMapEmbed('carlab-map');
    window.document.body.innerHTML = (await mapBox()).innerHTML;
    intersect[0]([{ isIntersecting: true } as IntersectionObserverEntry], {
      disconnect: () => undefined,
    } as unknown as IntersectionObserver);
    const body = window.document.body;

    expect(body.querySelector('carlab-map > iframe')).not.toBeNull();
    expect(body.querySelector('div > a')?.textContent).toContain(
      'Открыть в Google Maps',
    );
    vi.unstubAllGlobals();
  });
});
