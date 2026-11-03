import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import HomePage from './index.astro';

const { home, site } = content('ru');
const page = () =>
  render(HomePage as never, { path: '/ru/', params: { locale: 'ru' } });

describe('the home page', () => {
  it('leads the hero trust row with the Google rating', async () => {
    const root = await render(HomePage as never, {
      path: '/ru/',
      params: { locale: 'ru' },
    });
    const trust = [...root.querySelectorAll('ul')].find((list) =>
      list.textContent?.includes(home.hero.badges[0]!),
    )!;

    expect(trust.querySelector('li')?.textContent?.trim()).toBe(
      '5.0 в Google · 14 отзывов',
    );
  });

  it('opens on the CarLab mechanic, a wide cut on a phone and a tall one beside the copy', async () => {
    const root = await page();
    const hero = root.querySelector('section picture')!;
    const image = hero.querySelector('img')!;
    const tall = hero.querySelector('source')!;
    const preloads = [
      ...root.querySelectorAll('link[rel="preload"][as="image"]'),
    ];

    expect(image.getAttribute('src')).toContain('mechanic-wheel-lift-wide');
    expect(image.getAttribute('alt')).toBe(site.photos.heroMechanic);
    expect(image.getAttribute('sizes')).toBe('calc(100vw - 2.5rem)');
    expect(tall.getAttribute('media')).toBe('(min-width: 1024px)');
    expect(tall.getAttribute('srcset')).toContain('mechanic-wheel-lift-tall');
    expect(
      preloads.map((link) => [
        link.getAttribute('media'),
        link.getAttribute('imagesrcset'),
      ]),
    ).toEqual([
      ['(max-width: 1023px)', image.getAttribute('srcset')],
      ['(min-width: 1024px)', tall.getAttribute('srcset')],
    ]);
  });

  it('shows the street entrance in the visit panel', async () => {
    const image = (await page()).querySelector(
      '[data-contact-placement="visit"] img',
    )!;

    expect(image.getAttribute('src')).toContain('workshop-facade');
    expect(image.getAttribute('alt')).toBe(site.photos.facade);
  });
});
