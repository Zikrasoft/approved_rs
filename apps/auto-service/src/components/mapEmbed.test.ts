import { describe, expect, it } from 'vitest';
import MapEmbed from './MapEmbed.astro';
import { render } from './renderAstro';

describe('MapEmbed', () => {
  it('lazily embeds the garage map in the box the caller sizes', async () => {
    const map = (
      await render(MapEmbed, {
        path: '/ru/contact/',
        props: { title: 'Как доехать', class: 'h-64' },
      })
    ).querySelector<HTMLElement>('carlab-map')!;

    expect(map.dataset.src).toContain('google.com/maps');
    expect(map.dataset.title).toBe('Как доехать');
    expect(map.classList.contains('h-64')).toBe(true);
  });

  it('shows the address and a Google Maps link until the embed replaces it', async () => {
    const link = (
      await render(MapEmbed, { path: '/ru/contact/', props: { title: 'x' } })
    ).querySelector('carlab-map > a')!;

    expect(link.getAttribute('href')).toBe(
      'https://maps.google.com/?cid=4988774890072933706',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.textContent).toContain('Jovana Ćirilova 23a, Zvezdara');
    expect(link.textContent).toContain('Открыть в Google Maps');
  });
});
