import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import { render, heroOrder, heroPartsSearch } from '@/components/renderAstro';
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
      '5.0 в Google · 23 отзыва',
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

    expect(image.getAttribute('src')).toContain(
      'mechanic-engine-teardown-wide',
    );
    expect(image.getAttribute('alt')).toBe(site.photos.heroMechanic);
    expect(image.getAttribute('sizes')).toBe('calc(100vw - 2.5rem)');
    expect(tall.getAttribute('media')).toBe('(min-width: 1024px)');
    expect(tall.getAttribute('srcset')).toContain(
      'mechanic-engine-teardown-tall',
    );
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

  it('shows the street entrance and the one map in the visit panel', async () => {
    const root = await page();
    const image = root.querySelector('[data-contact-placement="visit"] img')!;

    expect(image.getAttribute('src')).toContain('workshop-facade');
    expect(image.getAttribute('alt')).toBe(site.photos.facade);
    expect(root.querySelectorAll('carlab-map')).toHaveLength(1);
    expect(
      root.querySelector('[data-contact-placement="visit"] carlab-map'),
    ).not.toBeNull();
  });
});

describe('the hero of the home page', () => {
  it('puts the address above the contacts and the contacts above the VIN search, as the homepage does', async () => {
    const [address, contacts, search] = heroOrder(await page());

    expect(address).toBeGreaterThan(-1);
    expect(address).toBeLessThan(contacts);
    expect(contacts).toBeLessThan(search);
  });
  it('offers the VIN parts search', async () => {
    expect(heroPartsSearch(await page())).not.toBeNull();
  });

  it('keeps its trust ticks on a phone', async () => {
    const ticks = heroPartsSearch(await page())!.nextElementSibling!;

    expect(ticks.textContent).toContain(home.hero.badges[0]);
    expect(ticks.classList).not.toContain('max-sm:hidden');
  });
});
