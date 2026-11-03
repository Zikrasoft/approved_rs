import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import GarageFacade from './GarageFacade.astro';
import { render } from './renderAstro';

const site = content('ru').site;
const facade = (slots = {}) =>
  render(GarageFacade, { path: '/ru/', props: {}, slots });

describe('GarageFacade', () => {
  it('shows the real CarLab entrance, described for a screen reader', async () => {
    const image = (await facade()).querySelector('img')!;

    expect(image.getAttribute('src')).toContain('workshop-facade');
    expect(image.getAttribute('alt')).toBe(site.photos.facade);
    expect(image.getAttribute('loading')).toBe('lazy');
  });

  it('never asks the 1280 px original for more than 640 css px', async () => {
    const image = (await facade()).querySelector('img')!;
    const widths = image
      .getAttribute('srcset')!
      .split(', ')
      .map((candidate) => Number(candidate.split(' ')[1]!.replace('w', '')));

    expect(image.getAttribute('sizes')).toBe(
      '(min-width: 1224px) 548px, (min-width: 1024px) calc(50vw - 44px), (min-width: 704px) 640px, (min-width: 640px) calc(100vw - 6.5rem), calc(100vw - 2.5rem)',
    );
    expect(Math.max(...widths)).toBe(1280);
    expect(image.className).toContain('sm:max-w-[40rem]');
  });

  it('stacks extra media, the contact page map, under the photo', async () => {
    const root = await facade({ default: '<div id="map"></div>' });

    expect(root.querySelector('img + #map')).not.toBeNull();
  });
});
