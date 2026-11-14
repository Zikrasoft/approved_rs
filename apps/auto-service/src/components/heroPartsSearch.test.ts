import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import { PARTS_INQUIRY_OPEN_ATTRIBUTE } from '@/scripts/partsList';
import HeroPartsSearch from './HeroPartsSearch.astro';
import { isOrange, render } from './renderAstro';

const { home } = content('sr');

const block = (props: Record<string, unknown>) =>
  render(HeroPartsSearch, { path: '/sr/services/', props });

describe('the hero parts search', () => {
  it('searches the catalogue and offers the manager inquiry in the page locale', async () => {
    const root = await block({ tone: 'card' });
    const inquiry = root.querySelector(`a[${PARTS_INQUIRY_OPEN_ATTRIBUTE}]`)!;

    expect(root.querySelector('h2')?.textContent?.trim()).toBe(
      home.hero.partsHeading,
    );
    expect(
      root.querySelector('catalogue-search form')?.getAttribute('action'),
    ).toBe('/sr/parts/search/');
    expect(
      root.querySelector('button[type="submit"]')?.textContent?.trim(),
    ).toBe(home.hero.partsSubmit);
    expect(inquiry.getAttribute('href')).toBe('/sr/parts/#inquiry');
    expect(inquiry.textContent?.trim()).toBe(home.hero.partsInquiry);
    expect(root.querySelector('carlab-modal dialog')).not.toBeNull();
  });

  it('follows the rating with the trust ticks', async () => {
    const root = await block({ tone: 'panel' });
    const ticks = [...root.querySelectorAll('ul li')].map((item) =>
      item.textContent?.trim(),
    );

    expect(ticks.slice(1)).toEqual(home.hero.badges);
    expect(ticks[0]).toContain('Google');
  });

  it('leaves the trust ticks to a hero that already shows them', async () => {
    const root = await block({ tone: 'panel', trust: false });

    expect(root.textContent).not.toContain(home.hero.badges[0]);
    expect(root.querySelector('h2')).not.toBeNull();
  });

  it.each([
    ['panel', 'btn-on-panel'],
    ['card', 'btn-secondary'],
  ])('keeps the %s submit off the orange', async (tone, button) => {
    const root = await block({ tone });

    expect(root.querySelector('button[type="submit"]')?.classList).toContain(
      button,
    );
    expect(
      [...root.querySelectorAll('*')].filter(
        (element) => isOrange(element) && !element.closest('dialog'),
      ),
    ).toEqual([]);
  });
});
